import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const PERMISSIONS = [
  // Super admin wildcard
  { resource: '*', action: '*', description: 'Super Administrator full wildcard permission' },

  // Tenants
  { resource: 'tenants', action: 'read', description: 'View tenant metadata and settings' },
  { resource: 'tenants', action: 'update', description: 'Update tenant metadata and configuration' },
  { resource: 'tenants', action: 'create', description: 'Provision new tenant organizations' },

  // Users
  { resource: 'users', action: 'read', description: 'List and view user profiles' },
  { resource: 'users', action: 'create', description: 'Create or invite new users' },
  { resource: 'users', action: 'update', description: 'Update user profiles and statuses' },
  { resource: 'users', action: 'delete', description: 'Deactivate or remove users' },

  // Roles & Permissions
  { resource: 'roles', action: 'read', description: 'View available roles and permissions' },
  { resource: 'roles', action: 'create', description: 'Create tenant custom roles' },
  { resource: 'roles', action: 'update', description: 'Modify custom role definitions' },
  { resource: 'roles', action: 'delete', description: 'Remove custom roles' },
  { resource: 'roles', action: 'assign', description: 'Assign roles to users' },

  // Media & Files
  { resource: 'files', action: 'upload', description: 'Upload media and documents' },
  { resource: 'files', action: 'read', description: 'View and download media files' },
  { resource: 'files', action: 'delete', description: 'Delete media files' },

  // Notifications
  { resource: 'notifications', action: 'read', description: 'View notifications and unread counters' },
  { resource: 'notifications', action: 'create', description: 'Dispatch in-app notifications' },

  // Audit Logs
  { resource: 'audit', action: 'read', description: 'Inspect compliance audit logs' },

  // Bookings (Future readiness)
  { resource: 'bookings', action: 'read', description: 'View booking schedules' },
  { resource: 'bookings', action: 'create', description: 'Create booking reservations' },
  { resource: 'bookings', action: 'update', description: 'Modify or reschedule bookings' },
  { resource: 'bookings', action: 'delete', description: 'Cancel bookings' }
];

async function seed() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Permissions Catalog
  console.log('Seeding permissions catalog...');
  const permissionMap = new Map();

  for (const perm of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: perm.resource,
          action: perm.action
        }
      },
      update: { description: perm.description },
      create: perm
    });
    permissionMap.set(`${perm.resource}:${perm.action}`, record.id);
  }

  // 2. Seed Default Tenant
  console.log('Seeding default organization...');
  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Organization',
      slug: 'default',
      status: 'ACTIVE',
      settings: {
        timezone: 'UTC',
        allowSelfRegistration: true
      }
    }
  });

  // 3. Seed Built-In System Roles
  console.log('Seeding system roles...');

  // SUPER_ADMIN (Global, tenantId: null)
  const superAdminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: null,
        name: 'SUPER_ADMIN'
      }
    },
    update: {},
    create: {
      tenantId: null,
      name: 'SUPER_ADMIN',
      description: 'System platform owner with cross-tenant root privileges',
      isSystem: true
    }
  });

  // Attach wildcard to SUPER_ADMIN
  const wildcardPermId = permissionMap.get('*:*');
  if (wildcardPermId) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: wildcardPermId
        }
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: wildcardPermId
      }
    });
  }

  // TENANT_ADMIN (Default Tenant)
  const tenantAdminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: defaultTenant.id,
        name: 'TENANT_ADMIN'
      }
    },
    update: {},
    create: {
      tenantId: defaultTenant.id,
      name: 'TENANT_ADMIN',
      description: 'Full organizational administrator',
      isSystem: true
    }
  });

  // Attach all non-wildcard permissions to TENANT_ADMIN
  for (const [key, permId] of permissionMap.entries()) {
    if (key !== '*:*') {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: tenantAdminRole.id,
            permissionId: permId
          }
        },
        update: {},
        create: {
          roleId: tenantAdminRole.id,
          permissionId: permId
        }
      });
    }
  }

  // TENANT_MEMBER (Default Tenant)
  const tenantMemberRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: defaultTenant.id,
        name: 'TENANT_MEMBER'
      }
    },
    update: {},
    create: {
      tenantId: defaultTenant.id,
      name: 'TENANT_MEMBER',
      description: 'Standard team staff member',
      isSystem: true
    }
  });

  const memberPerms = [
    'users:read',
    'files:upload',
    'files:read',
    'notifications:read',
    'bookings:read',
    'bookings:create',
    'bookings:update'
  ];
  for (const key of memberPerms) {
    const permId = permissionMap.get(key);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: tenantMemberRole.id,
            permissionId: permId
          }
        },
        update: {},
        create: {
          roleId: tenantMemberRole.id,
          permissionId: permId
        }
      });
    }
  }

  // 4. Seed Bootstrap Super Admin User
  console.log('Seeding super-admin user...');
  const passwordHash = await argon2.hash('Admin12345!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4
  });

  const superAdminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: defaultTenant.id,
        email: 'admin@booking.local'
      }
    },
    update: {},
    create: {
      tenantId: defaultTenant.id,
      email: 'admin@booking.local',
      passwordHash,
      firstName: 'Platform',
      lastName: 'SuperAdmin',
      status: 'ACTIVE',
      emailVerifiedAt: new Date()
    }
  });

  // Assign SUPER_ADMIN role to user
  await prisma.userRole.upsert({
    where: {
      tenantId_userId_roleId: {
        tenantId: defaultTenant.id,
        userId: superAdminUser.id,
        roleId: superAdminRole.id
      }
    },
    update: {},
    create: {
      tenantId: defaultTenant.id,
      userId: superAdminUser.id,
      roleId: superAdminRole.id
    }
  });

  console.log('✅ Seeding completed successfully.');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

