import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: {
    ENCRYPTION_KEY: 'a'.repeat(64), // 32 bytes hex
  },
}));

describe('Crypto Utils', () => {
  it('should encrypt and decrypt a token', async () => {
    const { encrypt, decrypt } = await import('../lib/crypto.js');
    const original = 'EAAGm0PX4ZCpsBALongMetaTokenHere12345';

    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(':'); // iv:tag:ciphertext format

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('should produce different ciphertexts for same input', async () => {
    const { encrypt } = await import('../lib/crypto.js');
    const token = 'same-token-value';

    const enc1 = encrypt(token);
    const enc2 = encrypt(token);
    expect(enc1).not.toBe(enc2); // random IV each time
  });

  it('should throw on corrupted ciphertext', async () => {
    const { decrypt } = await import('../lib/crypto.js');
    expect(() => decrypt('invalid:data:here')).toThrow();
  });

  it('should handle empty string', async () => {
    const { encrypt, decrypt } = await import('../lib/crypto.js');
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('should handle special characters', async () => {
    const { encrypt, decrypt } = await import('../lib/crypto.js');
    const token = 'token-with-spécial-chars!@#$%^&*()_+{}|:"<>?';
    expect(decrypt(encrypt(token))).toBe(token);
  });
});
