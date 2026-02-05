import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qa_guardian',

    // Redis
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    // JWT
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

    // Magic Link
    magicLinkSecret: process.env.MAGIC_LINK_SECRET || 'magic-link-secret',
    magicLinkExpiresIn: process.env.MAGIC_LINK_EXPIRES_IN || '15m',

    // CORS
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

    // Email
    smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM || 'qa-guardian@example.com',
    },

    // Slack
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,

    // S3
    s3: {
        endpoint: process.env.S3_ENDPOINT,
        bucket: process.env.S3_BUCKET || 'qa-guardian',
        accessKey: process.env.S3_ACCESS_KEY,
        secretKey: process.env.S3_SECRET_KEY,
        region: process.env.S3_REGION || 'auto',
    },

    // Test Target
    targetBaseUrl: process.env.TARGET_BASE_URL || 'https://casacarigar.com',

    // Scheduler
    scheduler: {
        dailySchedule: process.env.DAILY_SCHEDULE || '0 7 * * *',
        weeklySchedule: process.env.WEEKLY_SCHEDULE || '0 10 * * 0',
        timezone: process.env.TIMEZONE || 'Asia/Kolkata',
    },
};
