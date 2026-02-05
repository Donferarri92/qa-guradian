import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
    if (!transporter && config.smtp.host) {
        transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.port === 465,
            auth: config.smtp.user ? {
                user: config.smtp.user,
                pass: config.smtp.pass,
            } : undefined,
        });
    }
    return transporter;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
    const transport = getTransporter();

    if (!transport) {
        logger.warn('Email not configured, skipping send');
        return false;
    }

    try {
        await transport.sendMail({
            from: config.smtp.from,
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
        logger.info(`Email sent: ${options.subject}`);
        return true;
    } catch (error) {
        logger.error('Failed to send email:', error);
        return false;
    }
}

export async function sendP0FailureAlert(params: {
    runId: string;
    suiteName: string;
    environment: string;
    failures: string[];
    recipients: string[];
}) {
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">🚨 P0 Test Failure Alert</h1>
      </div>
      
      <div style="padding: 20px; background: #f9fafb;">
        <p><strong>Suite:</strong> ${params.suiteName}</p>
        <p><strong>Environment:</strong> ${params.environment}</p>
        <p><strong>Critical Failures:</strong></p>
        <ul style="background: white; padding: 15px 30px; border-radius: 4px;">
          ${params.failures.map(f => `<li style="color: #dc2626;">${f}</li>`).join('')}
        </ul>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="${dashboardUrl}/runs/${params.runId}" 
             style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            View Run Details
          </a>
        </div>
      </div>
      
      <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
        QA Guardian - Automated Testing Platform
      </div>
    </div>
  `;

    await sendEmail({
        to: params.recipients,
        subject: `🚨 [P0 FAILURE] ${params.suiteName} - ${params.environment}`,
        html,
        text: `P0 Test Failures in ${params.suiteName} (${params.environment}):\n\n${params.failures.join('\n')}\n\nView details: ${dashboardUrl}/runs/${params.runId}`,
    });
}

export async function sendRunCompleteNotification(params: {
    runId: string;
    suiteName: string;
    environment: string;
    passRate: number;
    passed: number;
    failed: number;
    recipients: string[];
}) {
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    const status = params.failed > 0 ? 'FAILED' : 'PASSED';
    const statusColor = params.failed > 0 ? '#dc2626' : '#16a34a';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${statusColor}; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">${status === 'PASSED' ? '✅' : '❌'} Test Run ${status}</h1>
      </div>
      
      <div style="padding: 20px; background: #f9fafb;">
        <p><strong>Suite:</strong> ${params.suiteName}</p>
        <p><strong>Environment:</strong> ${params.environment}</p>
        
        <div style="background: white; padding: 20px; border-radius: 4px; text-align: center;">
          <div style="font-size: 48px; font-weight: bold; color: ${statusColor};">
            ${params.passRate.toFixed(1)}%
          </div>
          <div style="color: #6b7280;">Pass Rate</div>
          <div style="margin-top: 10px;">
            <span style="color: #16a34a;">✓ ${params.passed} passed</span>
            ${params.failed > 0 ? `<span style="color: #dc2626; margin-left: 15px;">✗ ${params.failed} failed</span>` : ''}
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="${dashboardUrl}/runs/${params.runId}" 
             style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            View Full Report
          </a>
        </div>
      </div>
      
      <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
        QA Guardian - Automated Testing Platform
      </div>
    </div>
  `;

    await sendEmail({
        to: params.recipients,
        subject: `${status === 'PASSED' ? '✅' : '❌'} [${status}] ${params.suiteName} - ${params.passRate.toFixed(1)}% pass rate`,
        html,
        text: `Test Run ${status}\n\nSuite: ${params.suiteName}\nEnvironment: ${params.environment}\nPass Rate: ${params.passRate.toFixed(1)}%\nPassed: ${params.passed}\nFailed: ${params.failed}\n\nView details: ${dashboardUrl}/runs/${params.runId}`,
    });
}
