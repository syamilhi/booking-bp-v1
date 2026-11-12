import { Worker } from 'bullmq';
import { redisConnection } from '../../common/redis.js';
import { sendMailDirect } from './email.service.js';
import { systemPrisma } from '../../common/database.js';
import { logger } from '../../config/logger.js';

export function createEmailWorker() {
  const worker = new Worker(
    'email-queue',
    async (job) => {
      const { emailLogId, to, subject, html } = job.data;
      logger.info({ emailLogId, to, subject }, 'Processing email job');

      try {
        const result = await sendMailDirect({ to, subject, html });

        if (emailLogId) {
          await systemPrisma.emailLog.update({
            where: { id: emailLogId },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              providerId: result?.messageId || 'mock-id'
            }
          });
        }

        logger.info({ emailLogId, to }, 'Email dispatched successfully');
        return { success: true };
      } catch (error) {
        logger.error({ emailLogId, error: error.message }, 'Email job failed');

        if (emailLogId) {
          await systemPrisma.emailLog.update({
            where: { id: emailLogId },
            data: {
              status: job.attemptsMade < 3 ? 'RETRYING' : 'FAILED',
              error: error.message,
              retries: job.attemptsMade
            }
          });
        }

        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 1000
      }
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'BullMQ email worker job failed');
  });

  return worker;
}

