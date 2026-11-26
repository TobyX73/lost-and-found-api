import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
// OWASP minimum for scrypt: N=2^17, r=8, p=1.
const DEFAULT_PARAMS = { N: 2 ** 17, r: 8, p: 1 } as const;

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

function maxmemFor(N: number, r: number): number {
  // scrypt needs ~128 * N * r bytes; give headroom over Node's 32 MiB default.
  return 256 * N * r;
}

/**
 * Hashes passwords with scrypt and stores them as `scrypt$N$r$p$salt$hash`,
 * so the cost can be raised later without breaking existing hashes.
 */
@Injectable()
export class PasswordHasher {
  /** Overridable so tests can use a cheap cost. */
  protected readonly params: { N: number; r: number; p: number } = DEFAULT_PARAMS;

  async hash(password: string): Promise<string> {
    const { N, r, p } = this.params;
    const salt = randomBytes(SALT_LENGTH);
    const key = await scryptAsync(password, salt, KEY_LENGTH, { N, r, p, maxmem: maxmemFor(N, r) });
    return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, salt, hash] = parts;
    const N = Number(n);
    const R = Number(r);
    const P = Number(p);
    if (![N, R, P].every(Number.isSafeInteger)) return false;

    const expected = Buffer.from(hash, 'base64url');
    const actual = await scryptAsync(password, Buffer.from(salt, 'base64url'), expected.length, {
      N,
      r: R,
      p: P,
      maxmem: maxmemFor(N, R),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  needsRehash(stored: string): boolean {
    const [, n, r, p] = stored.split('$');
    const { N, r: R, p: P } = this.params;
    return Number(n) !== N || Number(r) !== R || Number(p) !== P;
  }
}
