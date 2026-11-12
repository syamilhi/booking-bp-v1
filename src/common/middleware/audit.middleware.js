import { systemPrisma } from '../database.js';
import { logger } from '../../config/logger.js';

/**
 * Express middleware that records state mutations to the compliance AuditLog
 * @param {string} action - Action identifier (e.g. "user.created", "role.updated")
 * @param {string} entityType - Target entity name (e.g. "User", "Role")
 */
export function auditLog(action, entityType) {
  return (req, res, next) => {
    // Intercept response to capture created/updated entity ID
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      res.locals.responseBody = body;
      return originalJson(body);
    };

    res.on('finish', async () => {
      // Only log successful state mutations (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const actorId = req.user?.id || null;
        const actorType = req.user ? 'USER' : 'SYSTEM';

        // Extract entity ID from route params or response body
        const entityId =
          req.params.id ||
          res.locals.responseBody?.data?.id ||
          'unknown';

        // Sanitize request body (strip sensitive fields like passwords)
        const sanitizedBody = req.body ? { ...req.body } : null;
        if (sanitizedBody) {
          delete sanitizedBody.password;
          delete sanitizedBody.newPassword;
          delete sanitizedBody.token;
        }

        try {
          if (tenantId) {
            await systemPrisma.auditLog.create({
              data: {
                tenantId,
                actorId,
                actorType,
                action,
                entity: entityType,
                entityId: String(entityId),
                newValues: sanitizedBody,
                ipAddress: req.ip || req.connection?.remoteAddress,
                userAgent: req.get('user-agent') || null
              }
            });
          }
        } catch (err) {
          logger.warn({ err: err.message, action, entityType }, 'Failed to record audit log');
        }
      }
    });

    next();
  };
}

