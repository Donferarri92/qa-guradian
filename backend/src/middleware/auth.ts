import { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';
import { config } from '../config.js';
import { prisma } from '../app.js';
import { AppError } from './error.js';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
}

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new AppError('No token provided', 401);
        }

        const token = authHeader.substring(7);
        const secret = new TextEncoder().encode(config.jwtSecret);

        const { payload } = await jose.jwtVerify(token, secret);

        const user = await prisma.user.findUnique({
            where: { id: payload.sub as string },
            select: { id: true, email: true, role: true },
        });

        if (!user) {
            throw new AppError('User not found', 401);
        }

        req.user = user;
        next();
    } catch (error) {
        if (error instanceof AppError) {
            next(error);
        } else {
            next(new AppError('Invalid token', 401));
        }
    }
};

export const requireRole = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new AppError('Not authenticated', 401));
        }

        if (!roles.includes(req.user.role)) {
            return next(new AppError('Insufficient permissions', 403));
        }

        next();
    };
};
