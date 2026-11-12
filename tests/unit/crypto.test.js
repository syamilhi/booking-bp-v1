import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateRandomToken,
  hashToken
} from '../../src/common/utils/crypto.js';

describe('Cryptographic Utilities', () => {
  it('should hash a password using Argon2id and verify correctly', async () => {
    const rawPassword = 'SecurePassword123!';
    const hash = await hashPassword(rawPassword);

    expect(hash).toBeDefined();
    expect(hash).toContain('$argon2id$');

    const isValid = await verifyPassword(rawPassword, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('WrongPassword', hash);
    expect(isInvalid).toBe(false);
  });

  it('should generate cryptographically random hex tokens', () => {
    const token1 = generateRandomToken(32);
    const token2 = generateRandomToken(32);

    expect(token1).toHaveLength(64); // 32 bytes = 64 hex characters
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it('should deterministically SHA-256 hash raw tokens', () => {
    const raw = 'my-test-token-12345';
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hashToken('different-token'));
  });
});

