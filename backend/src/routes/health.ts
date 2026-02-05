import { Router } from 'express';
import { prisma } from '../app.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
    try {
        // Check database connection
        await prisma.$queryRaw`SELECT 1`;

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'connected',
                api: 'running',
            },
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'disconnected',
                api: 'running',
            },
        });
    }
});
