import { getTenantPrisma, systemPrisma } from '../../common/database.js';

export class AuditService {
  /**
   * Paged query of compliance audit logs
   */
  async listAuditLogs(tenantId, { page = 1, limit = 50, entity, action, actorId, startDate, endDate }) {
    const tenantDb = getTenantPrisma(tenantId);
    const skip = (page - 1) * limit;

    const where = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (actorId) where.actorId = actorId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      tenantDb.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      tenantDb.auditLog.count({ where })
    ]);

    return {
      logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Paged query of customer activity timeline
   */
  async listActivities(tenantId, { page = 1, limit = 20, userId }) {
    const tenantDb = getTenantPrisma(tenantId);
    const skip = (page - 1) * limit;

    const where = {};
    if (userId) where.userId = userId;

    const [activities, total] = await Promise.all([
      tenantDb.activity.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      tenantDb.activity.count({ where })
    ]);

    return {
      activities,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Record human-readable business activity
   */
  async recordActivity(tenantId, userId, { action, summary, metadata = {} }) {
    const tenantDb = getTenantPrisma(tenantId);

    return tenantDb.activity.create({
      data: {
        tenantId,
        userId,
        action,
        summary,
        metadata
      }
    });
  }
}

export const auditService = new AuditService();

