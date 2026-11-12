import pino from 'pino';
import { env } from './env.js';

const isProduction = env.NODE_ENV === 'production';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : isProduction ? 'info' : 'debug',
  // Map level to GCP Cloud Logging severity field
  messageKey: 'message',
  formatters: {
    level(label) {
      const gcpSeverityMap = {
        trace: 'DEBUG',
        debug: 'DEBUG',
        info: 'INFO',
        warn: 'WARNING',
        error: 'ERROR',
        fatal: 'CRITICAL'
      };
      return { severity: gcpSeverityMap[label] || 'INFO' };
    }
  },
  transport:
    !isProduction && env.NODE_ENV !== 'test'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : undefined
});

