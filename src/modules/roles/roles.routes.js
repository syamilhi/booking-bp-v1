import { Router } from 'express';
import { rolesController } from './roles.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/middleware/rbac.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { createRoleSchema, updateRoleSchema, roleIdParamSchema } from './roles.schema.js';

export const rolesRouter = Router();

// Protect all role routes with authentication
rolesRouter.use(authenticate);

rolesRouter.get('/permissions', requirePermission('roles:read'), rolesController.listPermissions);

rolesRouter.get('/', requirePermission('roles:read'), rolesController.listRoles);
rolesRouter.post('/', requirePermission('roles:create'), validate(createRoleSchema), rolesController.createRole);
rolesRouter.get('/:id', requirePermission('roles:read'), validate(roleIdParamSchema), rolesController.getRole);
rolesRouter.put('/:id', requirePermission('roles:update'), validate(updateRoleSchema), rolesController.updateRole);
rolesRouter.delete('/:id', requirePermission('roles:delete'), validate(roleIdParamSchema), rolesController.deleteRole);

