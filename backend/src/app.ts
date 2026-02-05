import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { environmentsRouter } from './routes/environments.js';
import { suitesRouter } from './routes/suites.js';
import { runsRouter } from './routes/runs.js';
import { reportsRouter } from './routes/reports.js';
import { checklistsRouter } from './routes/checklists.js';
import { healthRouter } from './routes/health.js';

// Initialize Prisma Client for serverless with connection optimization
export const prisma = new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

// Ensure connection is established
prisma.$connect().catch((error) => {
    logger.error('Failed to connect to database', { error: error.message });
});

const app = express();

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
}));
app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
}));

// Rate limiting (adjusted for serverless)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
    next();
});

// Routes - mounted at /api for Netlify Functions
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/environments', environmentsRouter);
app.use('/api/suites', suitesRouter);
app.use('/api/runs', runsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/checklists', checklistsRouter);

// Also mount at /.netlify/functions/api for Netlify
app.use('/.netlify/functions/api/health', healthRouter);
app.use('/.netlify/functions/api/auth', authRouter);
app.use('/.netlify/functions/api/users', usersRouter);
app.use('/.netlify/functions/api/environments', environmentsRouter);
app.use('/.netlify/functions/api/suites', suitesRouter);
app.use('/.netlify/functions/api/runs', runsRouter);
app.use('/.netlify/functions/api/reports', reportsRouter);
app.use('/.netlify/functions/api/checklists', checklistsRouter);

// Error handling
app.use(errorHandler);

export default app;
