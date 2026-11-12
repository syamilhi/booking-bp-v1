import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

/**
 * Middleware ensuring user has the required permission(s)
 * Supports 'resource:action', 'resource:*', and global '*'
 * @param  {...string} requiredPermissions
 */
export function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    const userPermissions = req.user.permissions || [];

    // Super Admin root override
    if (userPermissions.includes('*')) {
      return next();
    }

    const hasAll = requiredPermissions.every((perm) => {
      const [resource] = perm.split(':');
      return (
        userPermissions.includes(perm) ||
        userPermissions.includes(`${resource}:*`)
      );
    });

    if (!hasAll) {
      return next(
        new ForbiddenError('You do not possess the required permissions for this action.', 'INSUFFICIENT_PERMISSIONS', {
          required: requiredPermissions,
          granted: userPermissions
        })
      );
    }

    next();
  };
}

/**
 * Middleware ensuring user has at least one of the required roles
 * @param  {...string} requiredRoles
 */
export function requireRole(...requiredRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    const userRoles = req.user.roles || [];

    // Super Admin role override
    if (userRoles.includes('SUPER_ADMIN')) {
      return next();
    }

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return next(
        new ForbiddenError('Your role does not grant access to this resource.', 'INSUFFICIENT_ROLE', {
          required: requiredRoles,
          assigned: userRoles
        })
      );
    }

    next();
  };
}

