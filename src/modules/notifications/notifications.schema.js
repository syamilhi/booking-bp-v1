import { z } from 'zod';

export const listNotificationsQuerySchema = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.enum(['UNREAD', 'READ', 'ARCHIVED']).optional()
  })
};

export const notificationIdParamSchema = {
  params: z.object({
    id: z.string().uuid()
  })
};

