import { config } from '../config.js';
import { logger } from '../utils/logger.js';

interface AlertPayload {
    type: 'P0_FAILURE' | 'THRESHOLD_BREACH' | 'RUN_COMPLETE';
    runId: string;
    suiteName: string;
    environment: string;
    failures?: string[];
    message?: string;
}

export async function sendAlert(payload: AlertPayload): Promise<void> {
    logger.info(`Alert triggered: ${payload.type}`, payload);

    // Send to Slack if configured
    if (config.slackWebhookUrl) {
        await sendSlackAlert(payload);
    }

    // TODO: Send email if configured
    // if (config.smtp.host) {
    //   await sendEmailAlert(payload);
    // }
}

async function sendSlackAlert(payload: AlertPayload): Promise<void> {
    const emoji = payload.type === 'P0_FAILURE' ? '🚨' : payload.type === 'THRESHOLD_BREACH' ? '⚠️' : '✅';

    let text = `${emoji} *QA Guardian Alert*\n`;
    text += `*Type:* ${payload.type}\n`;
    text += `*Suite:* ${payload.suiteName}\n`;
    text += `*Environment:* ${payload.environment}\n`;

    if (payload.failures && payload.failures.length > 0) {
        text += `*Failures:*\n`;
        for (const failure of payload.failures) {
            text += `• ${failure}\n`;
        }
    }

    if (payload.message) {
        text += `*Message:* ${payload.message}\n`;
    }

    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    text += `\n<${dashboardUrl}/runs/${payload.runId}|View Run Details>`;

    try {
        const response = await fetch(config.slackWebhookUrl!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text,
                        },
                    },
                ],
            }),
        });

        if (!response.ok) {
            logger.error('Failed to send Slack alert:', await response.text());
        } else {
            logger.info('Slack alert sent successfully');
        }
    } catch (error) {
        logger.error('Error sending Slack alert:', error);
    }
}

export async function sendEmailAlert(payload: AlertPayload): Promise<void> {
    // Implementation would use nodemailer
    // const transporter = nodemailer.createTransport({...});
    // await transporter.sendMail({...});
    logger.info('Email alert would be sent:', payload);
}
