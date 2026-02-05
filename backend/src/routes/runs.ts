import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../app.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { runTestSuite } from '../services/runner.js';

export const runsRouter = Router();

runsRouter.use(authenticate);

// List test runs
runsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { suiteId, environmentId, status, limit = '20', offset = '0' } = req.query;

    const where: any = {};
    if (suiteId) where.suiteId = suiteId;
    if (environmentId) where.environmentId = environmentId;
    if (status) where.status = status;

    const [runs, total] = await Promise.all([
        prisma.testRun.findMany({
            where,
            include: {
                suite: { select: { name: true, type: true } },
                environment: { select: { name: true, baseUrl: true } },
                triggeredBy: { select: { name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit as string, 10),
            skip: parseInt(offset as string, 10),
        }),
        prisma.testRun.count({ where }),
    ]);

    res.json({
        success: true,
        data: { runs, total },
    });
}));

// Get run details with results
runsRouter.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const run = await prisma.testRun.findUnique({
        where: { id: req.params.id },
        include: {
            suite: true,
            environment: true,
            triggeredBy: { select: { name: true, email: true } },
            results: {
                include: {
                    testCase: true,
                },
                orderBy: { testCase: { order: 'asc' } },
            },
            reports: true,
        },
    });

    if (!run) {
        throw new AppError('Run not found', 404);
    }

    res.json({
        success: true,
        data: { run },
    });
}));

// Create and start a test run
runsRouter.post('/', requireRole('ADMIN', 'TESTER'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const createSchema = z.object({
        suiteId: z.string().uuid(),
        environmentId: z.string().uuid(),
    });

    const { suiteId, environmentId } = createSchema.parse(req.body);

    // Verify suite and environment exist
    const [suite, environment] = await Promise.all([
        prisma.testSuite.findUnique({ where: { id: suiteId } }),
        prisma.environment.findUnique({ where: { id: environmentId } }),
    ]);

    if (!suite) throw new AppError('Suite not found', 404);
    if (!environment) throw new AppError('Environment not found', 404);

    // Get test case count
    const testCaseCount = await prisma.testCase.count({
        where: { suiteId, enabled: true },
    });

    // Create the run
    const run = await prisma.testRun.create({
        data: {
            suiteId,
            environmentId,
            triggeredById: req.user!.id,
            status: 'PENDING',
            totalTests: testCaseCount,
        },
        include: {
            suite: true,
            environment: true,
        },
    });

    // Start the test run asynchronously
    runTestSuite(run.id).catch(err => {
        console.error('Test run failed:', err);
    });

    res.status(201).json({
        success: true,
        data: { run },
        message: 'Test run started',
    });
}));

// Cancel a running test
runsRouter.post('/:id/cancel', requireRole('ADMIN', 'TESTER'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const run = await prisma.testRun.findUnique({
        where: { id: req.params.id },
    });

    if (!run) {
        throw new AppError('Run not found', 404);
    }

    if (run.status !== 'RUNNING' && run.status !== 'PENDING') {
        throw new AppError('Can only cancel pending or running tests', 400);
    }

    await prisma.testRun.update({
        where: { id: req.params.id },
        data: {
            status: 'CANCELLED',
            completedAt: new Date(),
        },
    });

    res.json({
        success: true,
        message: 'Test run cancelled',
    });
}));

// Get run statistics
runsRouter.get('/:id/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
    const run = await prisma.testRun.findUnique({
        where: { id: req.params.id },
        include: {
            results: {
                include: {
                    testCase: true,
                },
            },
        },
    });

    if (!run) {
        throw new AppError('Run not found', 404);
    }

    const stats = {
        total: run.totalTests,
        passed: run.passedTests,
        failed: run.failedTests,
        skipped: run.skippedTests,
        passRate: run.totalTests > 0 ? (run.passedTests / run.totalTests) * 100 : 0,
        duration: run.duration,
        bySeverity: {
            P0: { passed: 0, failed: 0, total: 0 },
            P1: { passed: 0, failed: 0, total: 0 },
            P2: { passed: 0, failed: 0, total: 0 },
        },
    };

    for (const result of run.results) {
        const severity = result.testCase.severity;
        stats.bySeverity[severity].total++;
        if (result.status === 'PASSED') {
            stats.bySeverity[severity].passed++;
        } else if (result.status === 'FAILED') {
            stats.bySeverity[severity].failed++;
        }
    }

    res.json({
        success: true,
        data: { stats },
    });
}));

// Get recent runs summary for dashboard
runsRouter.get('/summary/recent', asyncHandler(async (req: AuthRequest, res: Response) => {
    const runs = await prisma.testRun.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
            suite: { select: { name: true, type: true } },
            environment: { select: { name: true } },
        },
    });

    // Calculate trends
    const dailyRuns = await prisma.testRun.findMany({
        where: {
            suite: { type: 'DAILY' },
            status: { not: 'CANCELLED' },
        },
        take: 7,
        orderBy: { createdAt: 'desc' },
        select: {
            passedTests: true,
            totalTests: true,
            createdAt: true,
        },
    });

    const weeklyRuns = await prisma.testRun.findMany({
        where: {
            suite: { type: 'WEEKLY' },
            status: { not: 'CANCELLED' },
        },
        take: 4,
        orderBy: { createdAt: 'desc' },
        select: {
            passedTests: true,
            totalTests: true,
            metrics: true,
            createdAt: true,
        },
    });

    res.json({
        success: true,
        data: {
            recentRuns: runs,
            dailyTrend: dailyRuns.map(r => ({
                date: r.createdAt,
                passRate: r.totalTests > 0 ? (r.passedTests / r.totalTests) * 100 : 0,
            })),
            weeklyTrend: weeklyRuns.map(r => ({
                date: r.createdAt,
                passRate: r.totalTests > 0 ? (r.passedTests / r.totalTests) * 100 : 0,
                metrics: r.metrics,
            })),
        },
    });
}));

// Update a test result (for manual tests)
runsRouter.patch('/:runId/results/:resultId', requireRole('ADMIN', 'TESTER'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const updateSchema = z.object({
        status: z.enum(['PASSED', 'FAILED', 'SKIPPED']).optional(),
        manualNotes: z.string().optional(),
        screenshotUrl: z.string().optional(),
    });

    const data = updateSchema.parse(req.body);

    const result = await prisma.testResult.update({
        where: { id: req.params.resultId },
        data,
    });

    // Update run counts if status changed
    if (data.status) {
        const run = await prisma.testRun.findUnique({
            where: { id: req.params.runId },
            include: { results: true },
        });

        if (run) {
            const counts = run.results.reduce(
                (acc, r) => {
                    if (r.status === 'PASSED') acc.passed++;
                    else if (r.status === 'FAILED') acc.failed++;
                    else acc.skipped++;
                    return acc;
                },
                { passed: 0, failed: 0, skipped: 0 }
            );

            await prisma.testRun.update({
                where: { id: req.params.runId },
                data: {
                    passedTests: counts.passed,
                    failedTests: counts.failed,
                    skippedTests: counts.skipped,
                    status: counts.failed > 0 ? 'FAILED' : 'PASSED',
                },
            });
        }
    }

    res.json({
        success: true,
        data: { result },
    });
}));
