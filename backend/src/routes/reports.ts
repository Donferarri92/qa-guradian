import { Router, Response } from 'express';
import { prisma } from '../app.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { generateReport } from '../services/report.js';

export const reportsRouter = Router();

// Public report access (no auth required)
reportsRouter.get('/public/:shareToken', asyncHandler(async (req, res) => {
    const report = await prisma.report.findUnique({
        where: { shareToken: req.params.shareToken },
        include: {
            run: {
                include: {
                    suite: true,
                    environment: true,
                    results: {
                        include: { testCase: true },
                        orderBy: { testCase: { order: 'asc' } },
                    },
                },
            },
        },
    });

    if (!report) {
        throw new AppError('Report not found', 404);
    }

    if (!report.isPublic) {
        throw new AppError('Report is not public', 403);
    }

    if (report.expiresAt && report.expiresAt < new Date()) {
        throw new AppError('Report link has expired', 410);
    }

    res.json({
        success: true,
        data: { report },
    });
}));

// Protected routes
reportsRouter.use(authenticate);

// List reports
reportsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { limit = '20', offset = '0' } = req.query;

    const [reports, total] = await Promise.all([
        prisma.report.findMany({
            include: {
                run: {
                    include: {
                        suite: { select: { name: true, type: true } },
                        environment: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit as string, 10),
            skip: parseInt(offset as string, 10),
        }),
        prisma.report.count(),
    ]);

    res.json({
        success: true,
        data: { reports, total },
    });
}));

// Get report by ID
reportsRouter.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const report = await prisma.report.findUnique({
        where: { id: req.params.id },
        include: {
            run: {
                include: {
                    suite: true,
                    environment: true,
                    results: {
                        include: { testCase: true },
                        orderBy: { testCase: { order: 'asc' } },
                    },
                },
            },
        },
    });

    if (!report) {
        throw new AppError('Report not found', 404);
    }

    res.json({
        success: true,
        data: { report },
    });
}));

// Generate report for a run
reportsRouter.post('/generate/:runId', asyncHandler(async (req: AuthRequest, res: Response) => {
    const run = await prisma.testRun.findUnique({
        where: { id: req.params.runId },
    });

    if (!run) {
        throw new AppError('Run not found', 404);
    }

    if (run.status === 'RUNNING' || run.status === 'PENDING') {
        throw new AppError('Cannot generate report for incomplete run', 400);
    }

    // Check if report already exists
    const existing = await prisma.report.findFirst({
        where: { runId: req.params.runId },
    });

    if (existing) {
        res.json({
            success: true,
            data: { report: existing },
            message: 'Report already exists',
        });
        return;
    }

    const report = await generateReport(req.params.runId);

    res.status(201).json({
        success: true,
        data: { report },
    });
}));

// Toggle report public access
reportsRouter.patch('/:id/visibility', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { isPublic, expiresInDays } = req.body;

    const updateData: any = { isPublic };

    if (isPublic && expiresInDays) {
        updateData.expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    } else if (!isPublic) {
        updateData.expiresAt = null;
    }

    const report = await prisma.report.update({
        where: { id: req.params.id },
        data: updateData,
    });

    res.json({
        success: true,
        data: { report },
    });
}));

// Get comparison between two runs
reportsRouter.get('/compare/:runId1/:runId2', asyncHandler(async (req: AuthRequest, res: Response) => {
    const [run1, run2] = await Promise.all([
        prisma.testRun.findUnique({
            where: { id: req.params.runId1 },
            include: {
                suite: true,
                results: { include: { testCase: true } },
            },
        }),
        prisma.testRun.findUnique({
            where: { id: req.params.runId2 },
            include: {
                suite: true,
                results: { include: { testCase: true } },
            },
        }),
    ]);

    if (!run1 || !run2) {
        throw new AppError('One or both runs not found', 404);
    }

    // Build comparison
    const comparison = {
        run1: {
            id: run1.id,
            date: run1.createdAt,
            passRate: run1.totalTests > 0 ? (run1.passedTests / run1.totalTests) * 100 : 0,
            totalTests: run1.totalTests,
            passed: run1.passedTests,
            failed: run1.failedTests,
            metrics: run1.metrics,
        },
        run2: {
            id: run2.id,
            date: run2.createdAt,
            passRate: run2.totalTests > 0 ? (run2.passedTests / run2.totalTests) * 100 : 0,
            totalTests: run2.totalTests,
            passed: run2.passedTests,
            failed: run2.failedTests,
            metrics: run2.metrics,
        },
        changes: {
            passRateDelta: 0,
            newFailures: [] as string[],
            fixedTests: [] as string[],
        },
    };

    comparison.changes.passRateDelta = comparison.run2.passRate - comparison.run1.passRate;

    // Find new failures and fixed tests
    const run1Results = new Map(run1.results.map(r => [r.testCaseId, r.status]));
    const run2Results = new Map(run2.results.map(r => [r.testCaseId, r.status]));

    for (const result of run2.results) {
        const prevStatus = run1Results.get(result.testCaseId);
        if (prevStatus === 'PASSED' && result.status === 'FAILED') {
            comparison.changes.newFailures.push(result.testCase.name);
        } else if (prevStatus === 'FAILED' && result.status === 'PASSED') {
            comparison.changes.fixedTests.push(result.testCase.name);
        }
    }

    res.json({
        success: true,
        data: { comparison },
    });
}));

// Delete report
reportsRouter.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.report.delete({
        where: { id: req.params.id },
    });

    res.json({
        success: true,
        message: 'Report deleted',
    });
}));
