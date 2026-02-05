import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../app.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

export const checklistsRouter = Router();

checklistsRouter.use(authenticate);

// List checklists
checklistsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
    const { type } = req.query;

    const where: any = {};
    if (type) where.type = type;

    const checklists = await prisma.checklist.findMany({
        where,
        include: {
            items: {
                orderBy: { order: 'asc' },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    res.json({
        success: true,
        data: { checklists },
    });
}));

// Get checklist by ID
checklistsRouter.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    const checklist = await prisma.checklist.findUnique({
        where: { id: req.params.id },
        include: {
            items: {
                orderBy: { order: 'asc' },
            },
        },
    });

    if (!checklist) {
        throw new AppError('Checklist not found', 404);
    }

    res.json({
        success: true,
        data: { checklist },
    });
}));

// Create checklist
checklistsRouter.post('/', requireRole('ADMIN', 'TESTER'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const createSchema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(['DAILY', 'WEEKLY']),
        items: z.array(z.string()).optional(),
    });

    const { name, description, type, items } = createSchema.parse(req.body);

    const checklist = await prisma.checklist.create({
        data: {
            name,
            description,
            type,
            items: items ? {
                create: items.map((text, index) => ({
                    text,
                    order: index,
                })),
            } : undefined,
        },
        include: {
            items: {
                orderBy: { order: 'asc' },
            },
        },
    });

    res.status(201).json({
        success: true,
        data: { checklist },
    });
}));

// Update checklist
checklistsRouter.patch('/:id', requireRole('ADMIN', 'TESTER'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
    });

    const data = updateSchema.parse(req.body);

    const checklist = await prisma.checklist.update({
        where: { id: req.params.id },
        data,
        include: {
            items: {
                orderBy: { order: 'asc' },
            },
        },
    });

    res.json({
        success: true,
        data: { checklist },
    });
}));

// Delete checklist
checklistsRouter.delete('/:id', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const checklist = await prisma.checklist.findUnique({
        where: { id: req.params.id },
    });

    if (checklist?.isDefault) {
        throw new AppError('Cannot delete default checklist', 400);
    }

    await prisma.checklist.delete({
        where: { id: req.params.id },
    });

    res.json({
        success: true,
        message: 'Checklist deleted',
    });
}));

// --- Checklist Items ---

// Add item to checklist
checklistsRouter.post('/:id/items', requireRole('ADMIN', 'TESTER'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
        throw new AppError('Text is required', 400);
    }

    // Get max order
    const maxOrder = await prisma.checklistItem.aggregate({
        where: { checklistId: req.params.id },
        _max: { order: true },
    });

    const item = await prisma.checklistItem.create({
        data: {
            checklistId: req.params.id,
            text,
            order: (maxOrder._max.order || 0) + 1,
        },
    });

    res.status(201).json({
        success: true,
        data: { item },
    });
}));

// Update item
checklistsRouter.patch('/:checklistId/items/:itemId', requireRole('ADMIN', 'TESTER'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { text, order } = req.body;

    const item = await prisma.checklistItem.update({
        where: { id: req.params.itemId },
        data: { text, order },
    });

    res.json({
        success: true,
        data: { item },
    });
}));

// Delete item
checklistsRouter.delete('/:checklistId/items/:itemId', requireRole('ADMIN', 'TESTER'), asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.checklistItem.delete({
        where: { id: req.params.itemId },
    });

    res.json({
        success: true,
        message: 'Item deleted',
    });
}));

// Reorder items
checklistsRouter.post('/:id/items/reorder', requireRole('ADMIN', 'TESTER'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { itemIds } = req.body;

    if (!Array.isArray(itemIds)) {
        throw new AppError('itemIds must be an array', 400);
    }

    await prisma.$transaction(
        itemIds.map((id, index) =>
            prisma.checklistItem.update({
                where: { id },
                data: { order: index },
            })
        )
    );

    res.json({
        success: true,
        message: 'Items reordered',
    });
}));
