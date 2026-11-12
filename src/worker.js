import { createEmailWorker } from './modules/notifications/email.worker.js';
import { redisConnection } from './common/redis.js';
import { systemPrisma } from './common/database.js';
import { logger } from './config/logger.js';

logger.info('🚀 Starting BullMQ Background Worker Service...');

const emailWorker = createEmailWorker();

logger.info('✅ Email Queue Worker is active and consuming jobs.');

// Graceful Shutdown Handling
const shutdown = async (signal) => {
  logger.info({ signal }, 'Worker received shutdown signal. Closing consumers...');
  try {
    await emailWorker.close();
    await redisConnection.quit();
    await systemPrisma.$disconnect();
    logger.info('✅ Worker process stopped cleanly.');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during worker shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

