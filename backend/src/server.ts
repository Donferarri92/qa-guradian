import app, { prisma } from './app.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

// Start server
const PORT = config.port;

async function start() {
    try {
        await prisma.$connect();
        logger.info('Connected to database');

        app.listen(PORT, () => {
            logger.info(`QA Guardian API running on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await prisma.$disconnect();
    process.exit(0);
});
