import { getTenantPrisma, systemPrisma } from '../../common/database.js';
import { NotFoundError, ConflictError } from '../../common/errors/app-error.js';
import { hashPassword } from '../../common/utils/crypto.js';

export class UsersService {
  /**
   * Paged listing of users in tenant
   */
  async listUsers(tenantId, { page = 1, limit = 20, search, status }) {
    const tenantDb = getTenantPrisma(tenantId);
    const skip = (page - 1) * limit;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      tenantDb.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          tenantId: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatarUrl: true,
          status: true,
          emailVerifiedAt: true,
          createdAt: true,
          userRoles: {
            include: {
              role: {
                select: { id: true, name: true, isSystem: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      tenantDb.user.count({ where })
    ]);

    const formattedUsers = users.map((u) => ({
      ...u,
      roles: u.userRoles.map((ur) => ur.role)
    }));

    return {
      users: formattedUsers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single user by ID
   */
  async getUserById(tenantId, userId) {
    const tenantDb = getTenantPrisma(tenantId);

    const user = await tenantDb.user.findFirst({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: {
            role: {
              select: { id: true, name: true, description: true, isSystem: true }
            }
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundError('User not found.');
    }

    return {
      ...user,
      roles: user.userRoles.map((ur) => ur.role)
    };
  }

  /**
   * Create user directly by administrator
   */
  async createUser(tenantId, { email, password, firstName, lastName, phone, roleIds = [] }) {
    const tenantDb = getTenantPrisma(tenantId);

    const existing = await tenantDb.user.findFirst({ where: { email } });
    if (existing) {
      throw new ConflictError('A user with this email already exists in this organization.');
    }

    const passwordHash = await hashPassword(password);

    return systemPrisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId,
          email,
          passwordHash,
          firstName,
          lastName,
          phone,
          status: 'ACTIVE',
          emailVerifiedAt: new Date()
        }
      });

      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({
            tenantId,
            userId: user.id,
            roleId
          }))
        });
      }

      return tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          tenantId: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          status: true,
          createdAt: true
        }
      });
    });
  }

  /**
   * Update user details
   */
  async updateUser(tenantId, userId, data) {
    const tenantDb = getTenantPrisma(tenantId);

    await this.getUserById(tenantId, userId);

    return tenantDb.user.updateMany({
      where: { id: userId },
      data
    }).then(() => this.getUserById(tenantId, userId));
  }

  /**
   * Soft-delete or suspend user
   */
  async deleteUser(tenantId, userId) {
    const tenantDb = getTenantPrisma(tenantId);
    await this.getUserById(tenantId, userId);

    // Revoke user sessions
    await systemPrisma.session.updateMany({
      where: { userId },
      data: { isRevoked: true }
    });

    await tenantDb.user.updateMany({
      where: { id: userId },
      data: { status: 'INACTIVE' }
    });

    return { message: 'User deactivated successfully.' };
  }

  /**
   * Assign or replace user roles
   */
  async assignRoles(tenantId, userId, roleIds) {
    await this.getUserById(tenantId, userId);

    return systemPrisma.$transaction(async (tx) => {
      // Clear existing roles
      await tx.userRole.deleteMany({
        where: { tenantId, userId }
      });

      // Insert new roles
      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({
          tenantId,
          userId,
          roleId
        }))
      });

      return tx.userRole.findMany({
        where: { tenantId, userId },
        include: { role: true }
      });
    });
  }
}

export const usersService = new UsersService();

