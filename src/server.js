import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { systemPrisma } from './common/database.js';
import { redisConnection } from './common/redis.js';

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      env: env.NODE_ENV,
      prefix: env.API_PREFIX
    },
    `🚀 Server listening on port ${env.PORT}`
  );
});

// Graceful Shutdown for Cloud Run and Docker containers
const gracefulShutdown = async (signal) => {
  logger.info({ signal }, 'Received shutdown signal. Closing HTTP server...');

  server.close(async () => {
    logger.info('HTTP server closed. Terminating external connections...');
    try {
      await systemPrisma.$disconnect();
      await redisConnection.quit();
      logger.info('✅ Database and Redis connections closed cleanly.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during clean shutdown');
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds if hanging
  setTimeout(() => {
    logger.error('Forced shutdown timeout reached. Terminating process.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

