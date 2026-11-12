import { z } from 'zod';

export const listAuditLogsQuerySchema = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
    entity: z.string().optional(),
    action: z.string().optional(),
    actorId: z.string().uuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })
};

export const listActivitiesQuerySchema = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    userId: z.string().uuid().optional()
  })
};

