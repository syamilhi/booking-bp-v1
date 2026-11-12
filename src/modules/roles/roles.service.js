import { systemPrisma } from '../../common/database.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../common/errors/app-error.js';

export class RolesService {
  /**
   * List all roles accessible to this tenant (system roles + tenant custom roles)
   */
  async listRoles(tenantId) {
    return systemPrisma.role.findMany({
      where: {
        OR: [
          { tenantId },
          { tenantId: null }
        ]
      },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        },
        _count: {
          select: { userRoles: true }
        }
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }]
    });
  }

  /**
   * Fetch a single role
   */
  async getRoleById(tenantId, roleId) {
    const role = await systemPrisma.role.findFirst({
      where: {
        id: roleId,
        OR: [
          { tenantId },
          { tenantId: null }
        ]
      },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });

    if (!role) {
      throw new NotFoundError('Role not found.');
    }

    return role;
  }

  /**
   * Create a new custom role within the tenant
   */
  async createRole(tenantId, { name, description, permissionIds = [] }) {
    // Check name uniqueness in tenant
    const existing = await systemPrisma.role.findFirst({
      where: { tenantId, name }
    });

    if (existing) {
      throw new ConflictError(`A role named '${name}' already exists in this organization.`);
    }

    return systemPrisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          tenantId,
          name,
          description,
          isSystem: false
        }
      });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId
          }))
        });
      }

      return tx.role.findUnique({
        where: { id: role.id },
        include: {
          rolePermissions: {
            include: { permission: true }
          }
        }
      });
    });
  }

  /**
   * Update a custom role
   */
  async updateRole(tenantId, roleId, { name, description, permissionIds }) {
    const role = await this.getRoleById(tenantId, roleId);

    if (role.isSystem) {
      throw new BadRequestError('System-defined roles cannot be modified.');
    }

    if (name && name !== role.name) {
      const duplicate = await systemPrisma.role.findFirst({
        where: { tenantId, name, id: { not: roleId } }
      });
      if (duplicate) {
        throw new ConflictError(`A role named '${name}' already exists.`);
      }
    }

    return systemPrisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: roleId },
        data: {
          name: name || role.name,
          description: description !== undefined ? description : role.description
        }
      });

      if (Array.isArray(permissionIds)) {
        await tx.rolePermission.deleteMany({
          where: { roleId }
        });

        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId,
              permissionId
            }))
          });
        }
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          rolePermissions: {
            include: { permission: true }
          }
        }
      });
    });
  }

  /**
   * Delete a custom role
   */
  async deleteRole(tenantId, roleId) {
    const role = await this.getRoleById(tenantId, roleId);

    if (role.isSystem) {
      throw new BadRequestError('System-defined roles cannot be deleted.');
    }

    await systemPrisma.role.delete({
      where: { id: roleId }
    });

    return { message: 'Role deleted successfully.' };
  }

  /**
   * List global permission catalog
   */
  async listPermissions() {
    return systemPrisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }]
    });
  }
}

export const rolesService = new RolesService();

