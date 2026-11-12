import { describe, it, expect, vi } from 'vitest';
import { getTenantPrisma } from '../../src/common/database.js';

describe('Tenant Isolation Client Extension', () => {
  it('should require a valid tenantId when acquiring tenant Prisma instance', () => {
    expect(() => getTenantPrisma(null)).toThrow('Tenant context (tenantId) is required');
    expect(() => getTenantPrisma('')).toThrow('Tenant context (tenantId) is required');
  });

  it('should construct an isolated extension scoped to the target tenant', () => {
    const tenantAId = 'a0000000-0000-0000-0000-000000000001';
    const tenantBId = 'b0000000-0000-0000-0000-000000000002';

    const clientA = getTenantPrisma(tenantAId);
    const clientB = getTenantPrisma(tenantBId);

    expect(clientA).toBeDefined();
    expect(clientB).toBeDefined();
    expect(clientA).not.toBe(clientB);
  });
});

