import { PasswordHasher } from './password-hasher.js';

class CheapHasher extends PasswordHasher {
  protected override readonly params = { N: 2 ** 10, r: 8, p: 1 };
}

describe('PasswordHasher', () => {
  const hasher = new CheapHasher();

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hasher.hash('correct horse');
    expect(hash.startsWith('scrypt$1024$8$1$')).toBe(true);
    await expect(hasher.verify('correct horse', hash)).resolves.toBe(true);
    await expect(hasher.verify('wrong horse', hash)).resolves.toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hasher.hash('same')).not.toBe(await hasher.hash('same'));
  });

  it('rejects malformed hashes instead of throwing', async () => {
    await expect(hasher.verify('x', 'not-a-hash')).resolves.toBe(false);
    await expect(hasher.verify('x', 'bcrypt$1$2$3$4$5')).resolves.toBe(false);
  });

  it('flags hashes made with other parameters for rehash', async () => {
    const hash = await hasher.hash('pw');
    expect(hasher.needsRehash(hash)).toBe(false);
    expect(hasher.needsRehash(hash.replace('$1024$', '$2048$'))).toBe(true);
  });
});
