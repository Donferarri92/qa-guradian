import { spawn } from 'child_process';
import path from 'path';
import { prisma } from '../app.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { sendAlert } from './alerts.js';

export async function runTestSuite(runId: string): Promise<void> {
    const run = await prisma.testRun.findUnique({
        where: { id: runId },
        include: {
            suite: {
                include: {
                    testCases: {
                        where: { enabled: true },
                        orderBy: { order: 'asc' },
                    },
                },
            },
            environment: true,
        },
    });

    if (!run) {
        throw new Error(`Run ${runId} not found`);
    }

    logger.info(`Starting test run ${runId} for suite ${run.suite.name}`);

    // Update run status
    await prisma.testRun.update({
        where: { id: runId },
        data: {
            status: 'RUNNING',
            startedAt: new Date(),
        },
    });

    const startTime = Date.now();
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const p0Failures: string[] = [];

    try {
        // Create result entries for all test cases
        for (const testCase of run.suite.testCases) {
            await prisma.testResult.create({
                data: {
                    runId,
                    testCaseId: testCase.id,
                    status: 'SKIPPED',
                },
            });
        }

        // Run automated tests using Playwright
        const automatedTests = run.suite.testCases.filter(tc => tc.type === 'AUTOMATED');

        if (automatedTests.length > 0) {
            const testsDir = path.resolve(process.cwd(), '..', 'tests');

            // Group tests by file for efficiency
            const testsByFile = new Map<string, typeof automatedTests>();
            for (const test of automatedTests) {
                if (test.playwrightFile) {
                    const existing = testsByFile.get(test.playwrightFile) || [];
                    existing.push(test);
                    testsByFile.set(test.playwrightFile, existing);
                }
            }

            for (const [file, tests] of testsByFile) {
                try {
                    const result = await runPlaywrightTests(
                        testsDir,
                        file,
                        run.environment.baseUrl,
                        runId
                    );

                    // Update results based on Playwright output
                    for (const test of tests) {
                        const testResult = result.tests.find(
                            t => t.name === test.playwrightTest
                        );

                        const status = testResult?.passed ? 'PASSED' : 'FAILED';
                        const error = testResult?.error || null;

                        await prisma.testResult.updateMany({
                            where: { runId, testCaseId: test.id },
                            data: {
                                status,
                                error,
                                duration: testResult?.duration,
                                screenshotUrl: testResult?.screenshotUrl,
                            },
                        });

                        if (status === 'PASSED') {
                            passedCount++;
                        } else {
                            failedCount++;
                            if (test.severity === 'P0') {
                                p0Failures.push(test.name);
                            }
                        }
                    }
                } catch (error) {
                    logger.error(`Error running ${file}:`, error);
                    // Mark all tests in this file as failed
                    for (const test of tests) {
                        await prisma.testResult.updateMany({
                            where: { runId, testCaseId: test.id },
                            data: {
                                status: 'FAILED',
                                error: error instanceof Error ? error.message : 'Unknown error',
                            },
                        });
                        failedCount++;
                        if (test.severity === 'P0') {
                            p0Failures.push(test.name);
                        }
                    }
                }
            }
        }

        // Handle manual tests - they remain as SKIPPED until manually completed
        const manualTests = run.suite.testCases.filter(tc => tc.type === 'MANUAL');
        skippedCount = manualTests.length;

    } catch (error) {
        logger.error(`Test run ${runId} failed:`, error);
    }

    const duration = Date.now() - startTime;
    const finalStatus = failedCount > 0 ? 'FAILED' : 'PASSED';

    // Update run with final status
    await prisma.testRun.update({
        where: { id: runId },
        data: {
            status: finalStatus,
            completedAt: new Date(),
            passedTests: passedCount,
            failedTests: failedCount,
            skippedTests: skippedCount,
            duration,
        },
    });

    logger.info(`Test run ${runId} completed: ${finalStatus} (${passedCount}/${passedCount + failedCount} passed)`);

    // Send alert for P0 failures
    if (p0Failures.length > 0) {
        await sendAlert({
            type: 'P0_FAILURE',
            runId,
            suiteName: run.suite.name,
            environment: run.environment.name,
            failures: p0Failures,
        });
    }
}

interface PlaywrightResult {
    tests: Array<{
        name: string;
        passed: boolean;
        error?: string;
        duration?: number;
        screenshotUrl?: string;
    }>;
}

async function runPlaywrightTests(
    testsDir: string,
    file: string,
    baseUrl: string,
    runId: string
): Promise<PlaywrightResult> {
    return new Promise((resolve, reject) => {
        const outputFile = `/tmp/playwright-results-${runId}.json`;

        const args = [
            'playwright',
            'test',
            file,
            '--reporter=json',
            `--output=${outputFile}`,
        ];

        const env = {
            ...process.env,
            BASE_URL: baseUrl,
            RUN_ID: runId,
        };

        logger.info(`Running: npx ${args.join(' ')}`);

        const proc = spawn('npx', args, {
            cwd: testsDir,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            // Parse results from JSON output
            try {
                const results = JSON.parse(stdout);
                const tests = results.suites?.[0]?.specs?.map((spec: any) => ({
                    name: spec.title,
                    passed: spec.ok,
                    error: spec.tests?.[0]?.results?.[0]?.error?.message,
                    duration: spec.tests?.[0]?.results?.[0]?.duration,
                })) || [];

                resolve({ tests });
            } catch (error) {
                // If JSON parsing fails, report based on exit code
                if (code === 0) {
                    resolve({ tests: [] });
                } else {
                    reject(new Error(stderr || 'Playwright execution failed'));
                }
            }
        });

        proc.on('error', (error) => {
            reject(error);
        });
    });
}
