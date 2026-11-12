import { getTenantPrisma, systemPrisma } from '../../common/database.js';
import { NotFoundError } from '../../common/errors/app-error.js';

export class NotificationsService {
  /**
   * List in-app notifications for authenticated user
   */
  async listNotifications(tenantId, userId, { page = 1, limit = 20, status }) {
    const tenantDb = getTenantPrisma(tenantId);
    const skip = (page - 1) * limit;

    const where = { userId };
    if (status) {
      where.status = status;
    }

    const [notifications, total] = await Promise.all([
      tenantDb.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      tenantDb.notification.count({ where })
    ]);

    return {
      notifications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount(tenantId, userId) {
    const tenantDb = getTenantPrisma(tenantId);

    const count = await tenantDb.notification.count({
      where: {
        userId,
        status: 'UNREAD'
      }
    });

    return { unreadCount: count };
  }

  /**
   * Mark a specific notification as READ
   */
  async markAsRead(tenantId, userId, notificationId) {
    const tenantDb = getTenantPrisma(tenantId);

    const notification = await tenantDb.notification.findFirst({
      where: { id: notificationId, userId }
    });

    if (!notification) {
      throw new NotFoundError('Notification not found.');
    }

    return tenantDb.notification.updateMany({
      where: { id: notificationId, userId },
      data: {
        status: 'READ',
        readAt: new Date()
      }
    }).then(() => ({ message: 'Notification marked as read.' }));
  }

  /**
   * Mark all unread notifications for a user as READ
   */
  async markAllAsRead(tenantId, userId) {
    const tenantDb = getTenantPrisma(tenantId);

    const result = await tenantDb.notification.updateMany({
      where: { userId, status: 'UNREAD' },
      data: {
        status: 'READ',
        readAt: new Date()
      }
    });

    return { message: 'All notifications marked as read.', updatedCount: result.count };
  }

  /**
   * Create an in-app notification
   */
  async createNotification(tenantId, userId, { title, message, type = 'INFO', channel = 'IN_APP', metadata = {} }) {
    const tenantDb = getTenantPrisma(tenantId);

    return tenantDb.notification.create({
      data: {
        tenantId,
        userId,
        title,
        message,
        type,
        channel,
        status: 'UNREAD',
        metadata
      }
    });
  }
}

export const notificationsService = new NotificationsService();

