import { Router } from 'express';
import { usersController } from './users.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/middleware/rbac.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import {
  listUsersQuerySchema,
  userIdParamSchema,
  createUserSchema,
  updateUserSchema,
  assignRolesSchema
} from './users.schema.js';

export const usersRouter = Router();

// Protect all user routes with authentication
usersRouter.use(authenticate);

usersRouter.get('/', requirePermission('users:read'), validate(listUsersQuerySchema), usersController.listUsers);
usersRouter.post('/', requirePermission('users:create'), validate(createUserSchema), usersController.createUser);
usersRouter.get('/:id', requirePermission('users:read'), validate(userIdParamSchema), usersController.getUser);
usersRouter.patch('/:id', requirePermission('users:update'), validate(updateUserSchema), usersController.updateUser);
usersRouter.delete('/:id', requirePermission('users:delete'), validate(userIdParamSchema), usersController.deleteUser);
usersRouter.post('/:id/roles', requirePermission('roles:assign'), validate(assignRolesSchema), usersController.assignRoles);

