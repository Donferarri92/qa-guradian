import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../app.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

export const usersRouter = Router();

// All routes require authentication
usersRouter.use(authenticate);

// List users (admin only)
usersRouter.get('/', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    res.json({
        success: true,
        data: { users },
    });
}));

// Get user by ID (admin only)
usersRouter.get('/:id', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            lastLoginAt: true,
        },
    });

    if (!user) {
        throw new AppError('User not found', 404);
    }

    res.json({
        success: true,
        data: { user },
    });
}));

// Update user (admin only)
usersRouter.patch('/:id', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const updateSchema = z.object({
        name: z.string().optional(),
        role: z.enum(['ADMIN', 'TESTER', 'VIEWER']).optional(),
    });

    const data = updateSchema.parse(req.body);

    const user = await prisma.user.update({
        where: { id: req.params.id },
        data,
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
        },
    });

    res.json({
        success: true,
        data: { user },
    });
}));

// Delete user (admin only)
usersRouter.delete('/:id', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    // Prevent self-deletion
    if (req.params.id === req.user!.id) {
        throw new AppError('Cannot delete yourself', 400);
    }

    await prisma.user.delete({
        where: { id: req.params.id },
    });

    res.json({
        success: true,
        message: 'User deleted',
    });
}));

// Create user (admin only)
usersRouter.post('/', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const createSchema = z.object({
        email: z.string().email(),
        password: z.string().min(6).optional(),
        name: z.string().optional(),
        role: z.enum(['ADMIN', 'TESTER', 'VIEWER']).default('TESTER'),
    });

    const { email, password, name, role } = createSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
        where: { email },
    });

    if (existing) {
        throw new AppError('Email already in use', 400);
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            name,
            role,
        },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
        },
    });

    res.status(201).json({
        success: true,
        data: { user },
    });
}));
