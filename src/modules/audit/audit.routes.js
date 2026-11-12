import { Router } from 'express';
import { auditController } from './audit.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/middleware/rbac.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { listAuditLogsQuerySchema, listActivitiesQuerySchema } from './audit.schema.js';

export const auditRouter = Router();

auditRouter.use(authenticate);

// Compliance audit logs (requires audit:read permission)
auditRouter.get('/logs', requirePermission('audit:read'), validate(listAuditLogsQuerySchema), auditController.listAuditLogs);

// User-facing activity stream
auditRouter.get('/activities', validate(listActivitiesQuerySchema), auditController.listActivities);

