import crypto from 'node:crypto';
import argon2 from 'argon2';

/**
 * Hash password using Argon2id with OWASP-recommended parameters
 */
export async function hashPassword(plainTextPassword) {
  return argon2.hash(plainTextPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4
  });
}

/**
 * Verify plain text password against an Argon2 hash
 */
export async function verifyPassword(plainTextPassword, hash) {
  try {
    return await argon2.verify(hash, plainTextPassword);
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically strong random token
 */
export function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * SHA-256 hash for database token lookup
 */
export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

