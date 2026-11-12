import { describe, it, expect, vi } from 'vitest';
import { requirePermission, requireRole } from '../../src/common/middleware/rbac.middleware.js';
import { ForbiddenError, UnauthorizedError } from '../../src/common/errors/app-error.js';

describe('RBAC Middleware', () => {
  it('should throw UnauthorizedError if user is not attached to request', () => {
    const middleware = requirePermission('users:read');
    const req = {};
    const res = {};
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should grant access if user has global wildcard permission', () => {
    const middleware = requirePermission('users:delete', 'roles:manage');
    const req = { user: { permissions: ['*'] } };
    const res = {};
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should grant access if user has exact permission', () => {
    const middleware = requirePermission('users:read');
    const req = { user: { permissions: ['users:read', 'files:upload'] } };
    const res = {};
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should grant access if user has resource wildcard permission', () => {
    const middleware = requirePermission('users:create');
    const req = { user: { permissions: ['users:*'] } };
    const res = {};
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject with ForbiddenError if user lacks permission', () => {
    const middleware = requirePermission('roles:delete');
    const req = { user: { permissions: ['users:read'] } };
    const res = {};
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('should enforce role membership correctly', () => {
    const middleware = requireRole('TENANT_ADMIN');

    const authorizedReq = { user: { roles: ['TENANT_ADMIN'] } };
    const nextAuth = vi.fn();
    middleware(authorizedReq, {}, nextAuth);
    expect(nextAuth).toHaveBeenCalledWith();

    const superAdminReq = { user: { roles: ['SUPER_ADMIN'] } };
    const nextSuper = vi.fn();
    middleware(superAdminReq, {}, nextSuper);
    expect(nextSuper).toHaveBeenCalledWith();

    const unauthorizedReq = { user: { roles: ['TENANT_MEMBER'] } };
    const nextUnauth = vi.fn();
    middleware(unauthorizedReq, {}, nextUnauth);
    expect(nextUnauth).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});

