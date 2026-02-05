import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { runTestSuite } from './runner.js';
import { prisma } from '../app.js';

let schedulerInitialized = false;

export async function initializeScheduler() {
    if (schedulerInitialized) return;

    const connection = new IORedis(config.redisUrl, {
        maxRetriesPerRequest: null,
    });

    // Create queue for test runs
    const testRunQueue = new Queue('test-runs', { connection });

    // Note: QueueScheduler is no longer needed in BullMQ v5+
    // The Worker now handles delayed/repeated jobs automatically

    // Create worker to process jobs
    const worker = new Worker(
        'test-runs',
        async (job) => {
            logger.info(`Processing job ${job.id}: ${job.name}`);

            if (job.name === 'scheduled-run') {
                const { suiteId, environmentId } = job.data;

                // Create a new run
                const suite = await prisma.testSuite.findUnique({
                    where: { id: suiteId },
                });

                const environment = await prisma.environment.findUnique({
                    where: { id: environmentId },
                });

                if (!suite || !environment) {
                    logger.error(`Suite or environment not found for scheduled run`);
                    return;
                }

                const testCaseCount = await prisma.testCase.count({
                    where: { suiteId, enabled: true },
                });

                const run = await prisma.testRun.create({
                    data: {
                        suiteId,
                        environmentId,
                        status: 'PENDING',
                        totalTests: testCaseCount,
                    },
                });

                await runTestSuite(run.id);
            }
        },
        { connection }
    );

    worker.on('completed', (job) => {
        logger.info(`Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`Job ${job?.id} failed:`, err);
    });

    // Schedule daily and weekly runs
    await scheduleRecurringJobs(testRunQueue);

    schedulerInitialized = true;
    logger.info('Scheduler initialized');
}

async function scheduleRecurringJobs(queue: Queue) {
    // Get all enabled suites with schedules
    const suites = await prisma.testSuite.findMany({
        where: {
            enabled: true,
            schedule: { not: null },
        },
    });

    // Get production environment
    const prodEnv = await prisma.environment.findFirst({
        where: { isProduction: true, isActive: true },
    });

    if (!prodEnv) {
        logger.warn('No production environment found for scheduled runs');
        return;
    }

    for (const suite of suites) {
        if (!suite.schedule) continue;

        const jobId = `scheduled-${suite.id}`;

        // Remove existing scheduled job if any
        const existingJobs = await queue.getRepeatableJobs();
        for (const job of existingJobs) {
            if (job.id === jobId) {
                await queue.removeRepeatableByKey(job.key);
            }
        }

        // Add new repeatable job
        await queue.add(
            'scheduled-run',
            {
                suiteId: suite.id,
                environmentId: prodEnv.id,
            },
            {
                repeat: {
                    pattern: suite.schedule,
                    tz: config.scheduler.timezone,
                },
                jobId,
            }
        );

        logger.info(`Scheduled ${suite.name} with pattern: ${suite.schedule}`);
    }
}

export async function triggerManualRun(suiteId: string, environmentId: string) {
    const connection = new IORedis(config.redisUrl, {
        maxRetriesPerRequest: null,
    });

    const queue = new Queue('test-runs', { connection });

    await queue.add(
        'scheduled-run',
        { suiteId, environmentId },
        { jobId: `manual-${Date.now()}` }
    );

    await connection.quit();
}

export async function getScheduledJobs() {
    const connection = new IORedis(config.redisUrl, {
        maxRetriesPerRequest: null,
    });

    const queue = new Queue('test-runs', { connection });
    const jobs = await queue.getRepeatableJobs();

    await connection.quit();

    return jobs;
}
