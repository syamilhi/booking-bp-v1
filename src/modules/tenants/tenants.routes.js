import { Router } from 'express';
import { tenantsController } from './tenants.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requirePermission, requireRole } from '../../common/middleware/rbac.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { createTenantSchema, updateTenantSchema } from './tenants.schema.js';

export const tenantsRouter = Router();

// Public or super-admin tenant provisioning
tenantsRouter.post('/', validate(createTenantSchema), tenantsController.createTenant);

// Authenticated tenant routes
tenantsRouter.get('/current', authenticate, requirePermission('tenants:read'), tenantsController.getCurrentTenant);
tenantsRouter.patch('/current', authenticate, requirePermission('tenants:update'), validate(updateTenantSchema), tenantsController.updateCurrentTenant);

// Global super-admin listing
tenantsRouter.get('/', authenticate, requireRole('SUPER_ADMIN'), tenantsController.listAllTenants);

