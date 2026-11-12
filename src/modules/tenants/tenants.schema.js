import { z } from 'zod';

export const createTenantSchema = {
  body: z.object({
    name: z.string().min(2).max(100).trim(),
    slug: z
      .string()
      .min(2)
      .max(50)
      .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase alphanumeric characters and hyphens')
      .trim(),
    settings: z.record(z.any()).default({})
  })
};

export const updateTenantSchema = {
  body: z.object({
    name: z.string().min(2).max(100).trim().optional(),
    settings: z.record(z.any()).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'TRIALING', 'DEACTIVATED']).optional()
  })
};

