import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './common/middleware/error.middleware.js';
import { NotFoundError } from './common/errors/app-error.js';

// Import domain route handlers
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { rolesRouter } from './modules/roles/roles.routes.js';
import { tenantsRouter } from './modules/tenants/tenants.routes.js';
import { filesRouter } from './modules/files/files.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';

export const app = express();

// Trust proxy for Cloudflare / Google Cloud Run reverse proxies
app.set('trust proxy', true);

// Global Security Middleware
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true
  })
);

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging (suppressed in test environment)
if (env.NODE_ENV !== 'test') {
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/healthz' || req.url === '/readyz'
      }
    })
  );
}

// Operational Health Probes (Liveness & Readiness)
app.use(healthRouter);

// Domain API Sub-routers
const apiRouter = express.Router();
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/roles', rolesRouter);
apiRouter.use('/tenants', tenantsRouter);
apiRouter.use('/files', filesRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/audit', auditRouter);

app.use(env.API_PREFIX, apiRouter);

// Catch-all 404 handler
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found.`));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

