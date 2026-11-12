import { systemPrisma } from '../../common/database.js';
import { NotFoundError, ConflictError } from '../../common/errors/app-error.js';

export class TenantsService {
  /**
   * Provision a new tenant and initialize default tenant roles
   */
  async createTenant({ name, slug, settings = {} }) {
    const existing = await systemPrisma.tenant.findUnique({
      where: { slug }
    });

    if (existing) {
      throw new ConflictError(`Tenant slug '${slug}' is already registered.`);
    }

    return systemPrisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          slug,
          status: 'ACTIVE',
          settings
        }
      });

      // Provision default TENANT_ADMIN role
      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'TENANT_ADMIN',
          description: 'Full organizational administrator',
          isSystem: true
        }
      });

      // Attach all non-wildcard permissions
      const permissions = await tx.permission.findMany({
        where: {
          NOT: { resource: '*', action: '*' }
        }
      });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: adminRole.id,
            permissionId: p.id
          }))
        });
      }

      // Provision default TENANT_MEMBER role
      const memberRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'TENANT_MEMBER',
          description: 'Standard staff member',
          isSystem: true
        }
      });

      const memberPermNames = [
        'users:read',
        'files:upload',
        'files:read',
        'notifications:read',
        'bookings:read',
        'bookings:create',
        'bookings:update'
      ];

      const memberPerms = permissions.filter((p) =>
        memberPermNames.includes(`${p.resource}:${p.action}`)
      );

      if (memberPerms.length > 0) {
        await tx.rolePermission.createMany({
          data: memberPerms.map((p) => ({
            roleId: memberRole.id,
            permissionId: p.id
          }))
        });
      }

      return tenant;
    });
  }

  /**
   * Get current tenant details
   */
  async getCurrentTenant(tenantId) {
    const tenant = await systemPrisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            users: true,
            roles: true
          }
        }
      }
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found.');
    }

    return tenant;
  }

  /**
   * Update current tenant
   */
  async updateCurrentTenant(tenantId, data) {
    const tenant = await systemPrisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found.');
    }

    return systemPrisma.tenant.update({
      where: { id: tenantId },
      data
    });
  }

  /**
   * List all tenants (Super Admin only)
   */
  async listAllTenants() {
    return systemPrisma.tenant.findMany({
      include: {
        _count: {
          select: { users: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export const tenantsService = new TenantsService();

