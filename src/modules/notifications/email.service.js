import nodemailer from 'nodemailer';
import { Queue } from 'bullmq';
import { env } from '../../config/env.js';
import { redisConnection } from '../../common/redis.js';
import { systemPrisma } from '../../common/database.js';
import { logger } from '../../config/logger.js';

// Setup Nodemailer transporter
export const mailTransporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth:
    env.SMTP_USER && env.SMTP_PASS
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS
        }
      : undefined
});

// Setup BullMQ Email Queue
export const emailQueue = new Queue('email-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

/**
 * Render responsive HTML email template
 */
export function renderEmailTemplate(template, data = {}) {
  switch (template) {
    case 'EMAIL_VERIFICATION':
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333;">Verify Your Email Address</h2>
          <p>Hello ${data.firstName || 'there'},</p>
          <p>Thank you for signing up. Please verify your email address to activate your account.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${data.verificationUrl || '#'}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
          </div>
          <p style="color: #666; font-size: 14px;">Or use token: <code>${data.token}</code></p>
          <p style="color: #888; font-size: 12px;">This link will expire in 24 hours.</p>
        </div>
      `;

    case 'PASSWORD_RESET':
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>We received a request to reset your account password.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${data.resetUrl || '#'}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">Or use token: <code>${data.token}</code></p>
          <p style="color: #888; font-size: 12px;">This link will expire in 1 hour. If you did not request this, you can ignore this email.</p>
        </div>
      `;

    default:
      return `<p>${data.message || ''}</p>`;
  }
}

/**
 * Enqueue an email job for background processing
 */
export async function enqueueEmail({ tenantId, recipient, subject, template, data = {} }) {
  const html = renderEmailTemplate(template, data);

  const emailLog = await systemPrisma.emailLog.create({
    data: {
      tenantId,
      recipient,
      subject,
      template,
      status: 'QUEUED'
    }
  });

  try {
    await emailQueue.add('send-email', {
      emailLogId: emailLog.id,
      to: recipient,
      subject,
      html
    });
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to enqueue email to Redis (will process directly if test)');
    if (env.NODE_ENV === 'test') {
      return { emailLogId: emailLog.id, queued: false };
    }
  }

  return { emailLogId: emailLog.id, queued: true };
}

/**
 * Direct email sender called by worker process
 */
export async function sendMailDirect({ to, subject, html, text }) {
  return mailTransporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text
  });
}

