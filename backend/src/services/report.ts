import { prisma } from '../app.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export async function generateReport(runId: string) {
    const run = await prisma.testRun.findUnique({
        where: { id: runId },
        include: {
            suite: true,
            environment: true,
            results: {
                include: { testCase: true },
                orderBy: { testCase: { order: 'asc' } },
            },
        },
    });

    if (!run) {
        throw new Error(`Run ${runId} not found`);
    }

    logger.info(`Generating report for run ${runId}`);

    // Generate report data
    const reportData = {
        generatedAt: new Date().toISOString(),
        run: {
            id: run.id,
            suite: run.suite.name,
            suiteType: run.suite.type,
            environment: run.environment.name,
            baseUrl: run.environment.baseUrl,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            duration: run.duration,
            status: run.status,
        },
        summary: {
            total: run.totalTests,
            passed: run.passedTests,
            failed: run.failedTests,
            skipped: run.skippedTests,
            passRate: run.totalTests > 0
                ? ((run.passedTests / run.totalTests) * 100).toFixed(1)
                : '0',
        },
        bySeverity: {
            P0: { passed: 0, failed: 0, total: 0 },
            P1: { passed: 0, failed: 0, total: 0 },
            P2: { passed: 0, failed: 0, total: 0 },
        },
        failures: [] as Array<{
            name: string;
            severity: string;
            error?: string;
            screenshotUrl?: string;
        }>,
        results: run.results.map(r => ({
            name: r.testCase.name,
            type: r.testCase.type,
            severity: r.testCase.severity,
            status: r.status,
            error: r.error,
            duration: r.duration,
            screenshotUrl: r.screenshotUrl,
        })),
        metrics: run.metrics,
    };

    // Calculate severity breakdown
    for (const result of run.results) {
        const severity = result.testCase.severity;
        reportData.bySeverity[severity].total++;
        if (result.status === 'PASSED') {
            reportData.bySeverity[severity].passed++;
        } else if (result.status === 'FAILED') {
            reportData.bySeverity[severity].failed++;
            reportData.failures.push({
                name: result.testCase.name,
                severity: result.testCase.severity,
                error: result.error || undefined,
                screenshotUrl: result.screenshotUrl || undefined,
            });
        }
    }

    // Create report entry in database
    const report = await prisma.report.create({
        data: {
            runId,
            jsonUrl: null, // Would be S3 URL in production
            pdfUrl: null,  // Would generate PDF and upload
            isPublic: false,
        },
    });

    // For now, store JSON data in memory/temp
    // In production, upload to S3 and save URL
    // await uploadToS3(`reports/${report.id}.json`, JSON.stringify(reportData));

    logger.info(`Report ${report.id} generated for run ${runId}`);

    return {
        ...report,
        data: reportData,
    };
}

export async function generatePDF(runId: string): Promise<Buffer> {
    const run = await prisma.testRun.findUnique({
        where: { id: runId },
        include: {
            suite: true,
            environment: true,
            results: {
                include: { testCase: true },
                orderBy: { testCase: { order: 'asc' } },
            },
        },
    });

    if (!run) {
        throw new Error(`Run ${runId} not found`);
    }

    // Generate PDF using PDFKit
    const PDFDocument = (await import('pdfkit')).default;

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({ margin: 50 });

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Title
        doc.fontSize(24).text('QA Guardian Test Report', { align: 'center' });
        doc.moveDown();

        // Summary section
        doc.fontSize(16).text('Summary');
        doc.fontSize(12);
        doc.text(`Suite: ${run.suite.name}`);
        doc.text(`Environment: ${run.environment.name} (${run.environment.baseUrl})`);
        doc.text(`Date: ${run.startedAt?.toISOString()}`);
        doc.text(`Status: ${run.status}`);
        doc.text(`Duration: ${run.duration ? `${(run.duration / 1000).toFixed(1)}s` : 'N/A'}`);
        doc.moveDown();

        // Pass rate
        const passRate = run.totalTests > 0
            ? ((run.passedTests / run.totalTests) * 100).toFixed(1)
            : '0';
        doc.fontSize(14).text(`Pass Rate: ${passRate}%`);
        doc.fontSize(12);
        doc.text(`Passed: ${run.passedTests} | Failed: ${run.failedTests} | Skipped: ${run.skippedTests}`);
        doc.moveDown();

        // Failures section
        const failures = run.results.filter(r => r.status === 'FAILED');
        if (failures.length > 0) {
            doc.fontSize(16).text('Failures');
            doc.fontSize(12);

            for (const failure of failures) {
                doc.text(`• [${failure.testCase.severity}] ${failure.testCase.name}`);
                if (failure.error) {
                    doc.fontSize(10).fillColor('red').text(`  Error: ${failure.error.substring(0, 200)}`);
                    doc.fillColor('black').fontSize(12);
                }
            }
            doc.moveDown();
        }

        // All results
        doc.fontSize(16).text('All Results');
        doc.fontSize(10);

        for (const result of run.results) {
            const icon = result.status === 'PASSED' ? '✓' : result.status === 'FAILED' ? '✗' : '○';
            doc.text(`${icon} [${result.testCase.severity}] ${result.testCase.name} - ${result.status}`);
        }

        doc.end();
    });
}

export async function getReportTrends(suiteType: 'DAILY' | 'WEEKLY', limit: number = 10) {
    const runs = await prisma.testRun.findMany({
        where: {
            suite: { type: suiteType },
            status: { in: ['PASSED', 'FAILED'] },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
            id: true,
            createdAt: true,
            passedTests: true,
            failedTests: true,
            totalTests: true,
            metrics: true,
        },
    });

    return runs.map(run => ({
        date: run.createdAt,
        passRate: run.totalTests > 0 ? (run.passedTests / run.totalTests) * 100 : 0,
        total: run.totalTests,
        passed: run.passedTests,
        failed: run.failedTests,
        metrics: run.metrics,
    })).reverse(); // Oldest first for charts
}
