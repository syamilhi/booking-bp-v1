import { notificationsService } from './notifications.service.js';

export class NotificationsController {
  async listNotifications(req, res, next) {
    try {
      const result = await notificationsService.listNotifications(
        req.tenant.id,
        req.user.id,
        req.query
      );
      res.status(200).json({
        success: true,
        data: result.notifications,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req, res, next) {
    try {
      const result = await notificationsService.getUnreadCount(req.tenant.id, req.user.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const result = await notificationsService.markAsRead(
        req.tenant.id,
        req.user.id,
        req.params.id
      );
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationsService.markAllAsRead(req.tenant.id, req.user.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationsController = new NotificationsController();

