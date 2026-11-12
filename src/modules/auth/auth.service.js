import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { systemPrisma, getTenantPrisma } from '../../common/database.js';
import {
  hashPassword,
  verifyPassword,
  generateRandomToken,
  hashToken
} from '../../common/utils/crypto.js';
import {
  UnauthorizedError,
  ConflictError,
  BadRequestError,
  NotFoundError
} from '../../common/errors/app-error.js';

/**
 * Generates a signed JWT Access Token
 */
function createAccessToken(user, permissions = [], roles = []) {
  return jwt.sign(
    {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
      permissions
    },
    env.JWT_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN }
  );
}

/**
 * Fetches flattened user permissions and role names
 */
async function getUserRolesAndPermissions(userId, tenantId) {
  const userRoles = await systemPrisma.userRole.findMany({
    where: { userId, tenantId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  });

  const roles = userRoles.map((ur) => ur.role.name);
  const permissionsSet = new Set();

  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      if (rp.permission.resource === '*' && rp.permission.action === '*') {
        permissionsSet.add('*');
      } else {
        permissionsSet.add(`${rp.permission.resource}:${rp.permission.action}`);
      }
    }
  }

  return {
    roles,
    permissions: Array.from(permissionsSet)
  };
}

export class AuthService {
  /**
   * Register a new user in the tenant
   */
  async register({ tenantId, email, password, firstName, lastName, phone }) {
    const tenantDb = getTenantPrisma(tenantId);

    // Check if user already exists
    const existing = await tenantDb.user.findFirst({
      where: { email }
    });

    if (existing) {
      throw new ConflictError('A user with this email address already exists in this organization.');
    }

    const passwordHash = await hashPassword(password);

    // Create user
    const user = await tenantDb.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        status: 'PENDING_VERIFICATION'
      }
    });

    // Assign default role (TENANT_MEMBER or TENANT_CUSTOMER)
    const defaultRole = await systemPrisma.role.findFirst({
      where: {
        OR: [
          { tenantId, name: 'TENANT_MEMBER' },
          { tenantId: null, name: 'TENANT_MEMBER' }
        ]
      }
    });

    if (defaultRole) {
      await systemPrisma.userRole.create({
        data: {
          tenantId,
          userId: user.id,
          roleId: defaultRole.id
        }
      });
    }

    // Generate email verification token (expires in 24 hours)
    const rawVerificationToken = generateRandomToken(32);
    const tokenHash = hashToken(rawVerificationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await tenantDb.token.create({
      data: {
        tenantId,
        userId: user.id,
        tokenHash,
        type: 'EMAIL_VERIFICATION',
        expiresAt
      }
    });

    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status
      },
      verificationToken: rawVerificationToken
    };
  }

  /**
   * Authenticate user credentials and issue token pair
   */
  async login({ tenantId, email, password, ipAddress, userAgent }) {
    const user = await systemPrisma.user.findUnique({
      where: {
        tenantId_email: { tenantId, email }
      }
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      throw new UnauthorizedError(`Account is currently ${user.status.toLowerCase()}.`);
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const { roles, permissions } = await getUserRolesAndPermissions(user.id, tenantId);

    // Issue rotating refresh token
    const rawRefreshToken = generateRandomToken(32);
    const refreshTokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN * 1000);

    await systemPrisma.session.create({
      data: {
        tenantId,
        userId: user.id,
        refreshTokenHash,
        ipAddress,
        userAgent,
        expiresAt,
        isRevoked: false
      }
    });

    const accessToken = createAccessToken(user, permissions, roles);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        roles,
        permissions
      }
    };
  }

  /**
   * Refresh access token and rotate refresh token with session reuse detection
   */
  async refreshTokens({ rawRefreshToken, ipAddress, userAgent }) {
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Refresh token is required.');
    }

    const refreshTokenHash = hashToken(rawRefreshToken);

    const session = await systemPrisma.session.findFirst({
      where: { refreshTokenHash },
      include: { user: true }
    });

    // Session reuse detection
    if (!session || session.isRevoked) {
      if (session) {
        // Potential breach! Revoke all sessions for this user family
        await systemPrisma.session.updateMany({
          where: { userId: session.userId },
          data: { isRevoked: true }
        });
      }
      throw new UnauthorizedError('Invalid or expired refresh token. Please sign in again.');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired. Please sign in again.');
    }

    if (session.user.status !== 'ACTIVE' && session.user.status !== 'PENDING_VERIFICATION') {
      throw new UnauthorizedError('User account is not active.');
    }

    // Rotate refresh token
    const newRawRefreshToken = generateRandomToken(32);
    const newRefreshTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN * 1000);

    await systemPrisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: newExpiresAt,
        ipAddress: ipAddress || session.ipAddress,
        userAgent: userAgent || session.userAgent
      }
    });

    const { roles, permissions } = await getUserRolesAndPermissions(
      session.user.id,
      session.tenantId
    );

    const accessToken = createAccessToken(session.user, permissions, roles);

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN
    };
  }

  /**
   * Revoke current session
   */
  async logout({ rawRefreshToken }) {
    if (!rawRefreshToken) return;
    const refreshTokenHash = hashToken(rawRefreshToken);
    await systemPrisma.session.updateMany({
      where: { refreshTokenHash },
      data: { isRevoked: true }
    });
  }

  /**
   * Verify user email via token
   */
  async verifyEmail({ token }) {
    const tokenHash = hashToken(token);

    const record = await systemPrisma.token.findFirst({
      where: {
        tokenHash,
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!record) {
      throw new BadRequestError('Invalid or expired verification token.');
    }

    await systemPrisma.$transaction([
      systemPrisma.user.update({
        where: { id: record.userId },
        data: {
          status: 'ACTIVE',
          emailVerifiedAt: new Date()
        }
      }),
      systemPrisma.token.update({
        where: { id: record.id },
        data: { usedAt: new Date() }
      })
    ]);

    return { message: 'Email address verified successfully.' };
  }

  /**
   * Request password reset token
   */
  async forgotPassword({ tenantId, email }) {
    const user = await systemPrisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } }
    });

    // To prevent account enumeration, return success even if user not found
    if (!user || user.status === 'SUSPENDED') {
      return { message: 'If an account exists, a password reset link has been dispatched.' };
    }

    // Invalidate existing reset tokens
    await systemPrisma.token.updateMany({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        usedAt: null
      },
      data: { usedAt: new Date() }
    });

    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await systemPrisma.token.create({
      data: {
        tenantId,
        userId: user.id,
        tokenHash,
        type: 'PASSWORD_RESET',
        expiresAt
      }
    });

    return {
      message: 'If an account exists, a password reset link has been dispatched.',
      resetToken: rawToken
    };
  }

  /**
   * Reset password with token and revoke active sessions
   */
  async resetPassword({ token, newPassword }) {
    const tokenHash = hashToken(token);

    const record = await systemPrisma.token.findFirst({
      where: {
        tokenHash,
        type: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!record) {
      throw new BadRequestError('Invalid or expired password reset token.');
    }

    const passwordHash = await hashPassword(newPassword);

    await systemPrisma.$transaction([
      systemPrisma.user.update({
        where: { id: record.userId },
        data: { passwordHash }
      }),
      systemPrisma.token.update({
        where: { id: record.id },
        data: { usedAt: new Date() }
      }),
      // Revoke all sessions to enforce re-login
      systemPrisma.session.updateMany({
        where: { userId: record.userId },
        data: { isRevoked: true }
      })
    ]);

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }
}

export const authService = new AuthService();

