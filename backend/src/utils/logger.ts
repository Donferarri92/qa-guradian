import winston from 'winston';
import { config } from '../config.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        log += ` ${JSON.stringify(metadata)}`;
    }
    if (stack) {
        log += `\n${stack}`;
    }
    return log;
});

export const logger = winston.createLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        new winston.transports.Console({
            format: combine(
                colorize(),
                logFormat
            ),
        }),
    ],
});

// Note: File transport is not available in serverless environments like Netlify Functions
// All console logs are captured by Netlify and available in the function logs dashboard

