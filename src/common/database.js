import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

// Base Prisma Client instance
export const systemPrisma = new PrismaClient({
  log:
    env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' }
        ]
      : [{ emit: 'stdout', level: 'error' }]
});

if (env.NODE_ENV === 'development') {
  systemPrisma.$on('query', (e) => {
    logger.debug({ query: e.query, params: e.params, duration: `${e.duration}ms` }, 'Database Query');
  });
}

/**
 * Models that are strictly scoped to a tenant
 */
const TENANT_SCOPED_MODELS = [
  'User',
  'Session',
  'Token',
  'UserRole',
  'Notification',
  'EmailLog',
  'File',
  'Upload',
  'AuditLog',
  'Activity'
];

/**
 * Returns a Prisma Client instance extended to enforce row-level tenant isolation
 * @param {string} tenantId - UUID of the active tenant
 */
export function getTenantPrisma(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant context (tenantId) is required for tenant-scoped database operations.');
  }

  return systemPrisma.$extends({
    name: `tenant-isolation-${tenantId}`,
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },
        async create({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.data = { ...args.data, tenantId };
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        }
      }
    }
  });
}

