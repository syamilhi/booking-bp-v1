import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('Authentication & Validation Middleware', () => {
  it('POST /api/v1/auth/register should reject invalid email format with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'invalid-email-format',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.some((d) => d.path === 'email')).toBe(true);
  });

  it('POST /api/v1/auth/register should reject weak password with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'valid@example.com',
        password: 'weak',
        firstName: 'John',
        lastName: 'Doe'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.some((d) => d.path === 'password')).toBe(true);
  });

  it('POST /api/v1/auth/login should reject missing password with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'user@example.com'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('GET /api/v1/auth/me should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/users should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/users');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/files/upload-url should reject unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/v1/files/upload-url')
      .send({
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024
      });

    expect(res.status).toBe(401);
  });
});

