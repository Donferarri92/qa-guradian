import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../app.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

export const suitesRouter = Router();

suitesRouter.use(authenticate);

// List test suites
suitesRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const suites = await prisma.testSuite.findMany({
        include: {
            _count: {
                select: { testCases: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    res.json({
        success: true,
        data: { suites },
    });
}));

// Get suite with test cases
suitesRouter.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const suite = await prisma.testSuite.findUnique({
        where: { id: req.params.id },
        include: {
            testCases: {
                orderBy: { order: 'asc' },
            },
        },
    });

    if (!suite) {
        throw new AppError('Suite not found', 404);
    }

    res.json({
        success: true,
        data: { suite },
    });
}));

// Create suite (admin only)
suitesRouter.post('/', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const createSchema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(['DAILY', 'WEEKLY']),
        schedule: z.string().optional(),
        enabled: z.boolean().default(true),
    });

    const data = createSchema.parse(req.body);

    const suite = await prisma.testSuite.create({
        data,
    });

    res.status(201).json({
        success: true,
        data: { suite },
    });
}));

// Update suite (admin only)
suitesRouter.patch('/:id', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        schedule: z.string().optional(),
        enabled: z.boolean().optional(),
    });

    const data = updateSchema.parse(req.body);

    const suite = await prisma.testSuite.update({
        where: { id: req.params.id },
        data,
    });

    res.json({
        success: true,
        data: { suite },
    });
}));

// Delete suite (admin only)
suitesRouter.delete('/:id', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.testSuite.delete({
        where: { id: req.params.id },
    });

    res.json({
        success: true,
        message: 'Suite deleted',
    });
}));

// --- Test Cases ---

// Add test case to suite
suitesRouter.post('/:id/cases', requireRole('ADMIN', 'TESTER'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const createSchema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(['AUTOMATED', 'MANUAL']),
        severity: z.enum(['P0', 'P1', 'P2']).default('P1'),
        steps: z.any().optional(),
        playwrightFile: z.string().optional(),
        playwrightTest: z.string().optional(),
    });

    const data = createSchema.parse(req.body);

    // Get max order
    const maxOrder = await prisma.testCase.aggregate({
        where: { suiteId: req.params.id },
        _max: { order: true },
    });

    const testCase = await prisma.testCase.create({
        data: {
            ...data,
            suiteId: req.params.id,
            order: (maxOrder._max.order || 0) + 1,
        },
    });

    res.status(201).json({
        success: true,
        data: { testCase },
    });
}));

// Update test case
suitesRouter.patch('/:suiteId/cases/:caseId', requireRole('ADMIN', 'TESTER'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        severity: z.enum(['P0', 'P1', 'P2']).optional(),
        steps: z.any().optional(),
        playwrightFile: z.string().optional(),
        playwrightTest: z.string().optional(),
        enabled: z.boolean().optional(),
        order: z.number().optional(),
    });

    const data = updateSchema.parse(req.body);

    const testCase = await prisma.testCase.update({
        where: { id: req.params.caseId },
        data,
    });

    res.json({
        success: true,
        data: { testCase },
    });
}));

// Delete test case
suitesRouter.delete('/:suiteId/cases/:caseId', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.testCase.delete({
        where: { id: req.params.caseId },
    });

    res.json({
        success: true,
        message: 'Test case deleted',
    });
}));

// Reorder test cases
suitesRouter.post('/:id/cases/reorder', requireRole('ADMIN', 'TESTER'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { caseIds } = req.body;

    if (!Array.isArray(caseIds)) {
        throw new AppError('caseIds must be an array', 400);
    }

    await prisma.$transaction(
        caseIds.map((id, index) =>
            prisma.testCase.update({
                where: { id },
                data: { order: index },
            })
        )
    );

    res.json({
        success: true,
        message: 'Test cases reordered',
    });
}));
