import { z } from 'zod';

export const createRoleSchema = {
  body: z.object({
    name: z.string().min(2).max(100).trim(),
    description: z.string().max(255).optional(),
    permissionIds: z.array(z.string().uuid()).default([])
  })
};

export const updateRoleSchema = {
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    name: z.string().min(2).max(100).trim().optional(),
    description: z.string().max(255).optional(),
    permissionIds: z.array(z.string().uuid()).optional()
  })
};

export const roleIdParamSchema = {
  params: z.object({
    id: z.string().uuid()
  })
};

