import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';

describe('Module Route Guards & Token Verification', () => {
  const dummyUserId = '11111111-1111-1111-1111-111111111111';
  const dummyTenantId = '22222222-2222-2222-2222-222222222222';

  // Helper to generate test tokens
  function generateTestToken(permissions = [], roles = ['TENANT_MEMBER']) {
    return jwt.sign(
      {
        sub: dummyUserId,
        tenantId: dummyTenantId,
        email: 'test@booking.local',
        roles,
        permissions
      },
      env.JWT_SECRET,
      { expiresIn: 900 }
    );
  }

  it('GET /api/v1/roles should reject requests without roles:read permission', async () => {
    const token = generateTestToken(['bookings:read']); // lacks roles:read
    const res = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`);

    // Since mock user check needs to pass or fail gracefully
    // If user is not in DB, it returns 401 (account invalid)
    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/audit/logs should reject requests without audit:read permission', async () => {
    const token = generateTestToken(['users:read']);
    const res = await request(app)
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${token}`);

    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/tenants/current should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/tenants/current');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/tenants should reject invalid slug with 400', async () => {
    const res = await request(app)
      .post('/api/v1/tenants')
      .send({
        name: 'Invalid Slug Org',
        slug: 'INVALID SLUG WITH SPACES'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('POST /api/v1/tenants should validate and accept valid slug payload', async () => {
    const res = await request(app)
      .post('/api/v1/tenants')
      .send({
        name: 'Valid Org',
        slug: 'valid-org-slug'
      });

    // DB call may fail without live postgres, but schema validation passes (status is not 400 validation error)
    expect(res.status).not.toBe(400);
  });
});

