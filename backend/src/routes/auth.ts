import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../app.js';
import { config } from '../config.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const authRouter = Router();

// Validation schemas
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().optional(),
});

const magicLinkSchema = z.object({
    email: z.string().email(),
});

// Generate JWT token
async function generateToken(userId: string): Promise<string> {
    const secret = new TextEncoder().encode(config.jwtSecret);
    const token = await new jose.SignJWT({ sub: userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(config.jwtExpiresIn)
        .sign(secret);
    return token;
}

// Login
authRouter.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user || !user.passwordHash) {
        throw new AppError('Invalid credentials', 401);
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
        throw new AppError('Invalid credentials', 401);
    }

    // Update last login
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    const token = await generateToken(user.id);

    res.json({
        success: true,
        data: {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        },
    });
}));

// Register (admin only in production, open in dev)
authRouter.post('/register', asyncHandler(async (req, res) => {
    const { email, password, name } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        throw new AppError('Email already registered', 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // First user becomes admin
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? 'ADMIN' : 'TESTER';

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            name,
            role,
        },
    });

    const token = await generateToken(user.id);

    res.status(201).json({
        success: true,
        data: {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        },
    });
}));

// Request magic link
authRouter.post('/magic-link', asyncHandler(async (req, res) => {
    const { email } = magicLinkSchema.parse(req.body);

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        // Don't reveal if user exists
        res.json({
            success: true,
            message: 'If an account exists, a magic link will be sent',
        });
        return;
    }

    // Generate magic link token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.magicLink.create({
        data: {
            token,
            userId: user.id,
            expiresAt,
        },
    });

    // TODO: Send email with magic link
    // For development, return the token
    if (config.nodeEnv === 'development') {
        res.json({
            success: true,
            message: 'Magic link generated',
            devToken: token, // Only in development
        });
    } else {
        res.json({
            success: true,
            message: 'If an account exists, a magic link will be sent',
        });
    }
}));

// Verify magic link
authRouter.post('/magic-link/verify', asyncHandler(async (req, res) => {
    const { token } = req.body;

    if (!token) {
        throw new AppError('Token required', 400);
    }

    const magicLink = await prisma.magicLink.findUnique({
        where: { token },
        include: { user: true },
    });

    if (!magicLink) {
        throw new AppError('Invalid token', 400);
    }

    if (magicLink.usedAt) {
        throw new AppError('Token already used', 400);
    }

    if (magicLink.expiresAt < new Date()) {
        throw new AppError('Token expired', 400);
    }

    // Mark as used
    await prisma.magicLink.update({
        where: { id: magicLink.id },
        data: { usedAt: new Date() },
    });

    // Update last login
    await prisma.user.update({
        where: { id: magicLink.userId },
        data: { lastLoginAt: new Date() },
    });

    const jwtToken = await generateToken(magicLink.userId);

    res.json({
        success: true,
        data: {
            token: jwtToken,
            user: {
                id: magicLink.user.id,
                email: magicLink.user.email,
                name: magicLink.user.name,
                role: magicLink.user.role,
            },
        },
    });
}));

// Get current user
authRouter.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            lastLoginAt: true,
        },
    });

    res.json({
        success: true,
        data: { user },
    });
}));

// Update password
authRouter.post('/password', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        throw new AppError('New password must be at least 6 characters', 400);
    }

    const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
    });

    if (user?.passwordHash && currentPassword) {
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) {
            throw new AppError('Current password incorrect', 400);
        }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: req.user!.id },
        data: { passwordHash },
    });

    res.json({
        success: true,
        message: 'Password updated',
    });
}));
