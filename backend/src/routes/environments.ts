import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../app.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

export const environmentsRouter = Router();

environmentsRouter.use(authenticate);

// List environments
environmentsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const environments = await prisma.environment.findMany({
        orderBy: { createdAt: 'desc' },
    });

    res.json({
        success: true,
        data: { environments },
    });
}));

// Get environment by ID
environmentsRouter.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const environment = await prisma.environment.findUnique({
        where: { id: req.params.id },
    });

    if (!environment) {
        throw new AppError('Environment not found', 404);
    }

    res.json({
        success: true,
        data: { environment },
    });
}));

// Create environment (admin only)
environmentsRouter.post('/', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const createSchema = z.object({
        name: z.string().min(1),
        baseUrl: z.string().url(),
        isProduction: z.boolean().default(false),
    });

    const data = createSchema.parse(req.body);

    const environment = await prisma.environment.create({
        data,
    });

    res.status(201).json({
        success: true,
        data: { environment },
    });
}));

// Update environment (admin only)
environmentsRouter.patch('/:id', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const updateSchema = z.object({
        name: z.string().min(1).optional(),
        baseUrl: z.string().url().optional(),
        isProduction: z.boolean().optional(),
        isActive: z.boolean().optional(),
    });

    const data = updateSchema.parse(req.body);

    const environment = await prisma.environment.update({
        where: { id: req.params.id },
        data,
    });

    res.json({
        success: true,
        data: { environment },
    });
}));

// Delete environment (admin only)
environmentsRouter.delete('/:id', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check for associated test runs
    const runCount = await prisma.testRun.count({
        where: { environmentId: req.params.id },
    });

    if (runCount > 0) {
        throw new AppError('Cannot delete environment with test runs', 400);
    }

    await prisma.environment.delete({
        where: { id: req.params.id },
    });

    res.json({
        success: true,
        message: 'Environment deleted',
    });
}));
