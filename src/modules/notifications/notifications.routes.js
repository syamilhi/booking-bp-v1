import { Router } from 'express';
import { notificationsController } from './notifications.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema
} from './notifications.schema.js';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get('/', validate(listNotificationsQuerySchema), notificationsController.listNotifications);
notificationsRouter.get('/unread-count', notificationsController.getUnreadCount);
notificationsRouter.patch('/:id/read', validate(notificationIdParamSchema), notificationsController.markAsRead);
notificationsRouter.post('/mark-all-read', notificationsController.markAllAsRead);

