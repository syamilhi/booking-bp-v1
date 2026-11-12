import { z } from 'zod';

export const listUsersQuerySchema = {
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).optional()
  })
};

export const userIdParamSchema = {
  params: z.object({
    id: z.string().uuid()
  })
};

export const createUserSchema = {
  body: z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(8),
    firstName: z.string().min(1).max(100).trim(),
    lastName: z.string().min(1).max(100).trim(),
    phone: z.string().max(50).optional(),
    roleIds: z.array(z.string().uuid()).default([])
  })
};

export const updateUserSchema = {
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    firstName: z.string().min(1).max(100).trim().optional(),
    lastName: z.string().min(1).max(100).trim().optional(),
    phone: z.string().max(50).optional().nullable(),
    avatarUrl: z.string().url().max(500).optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).optional()
  })
};

export const assignRolesSchema = {
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    roleIds: z.array(z.string().uuid()).min(1, 'At least one role ID must be assigned')
  })
};

