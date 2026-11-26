import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema.js';
import type { User } from '../users/user.entity.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import type { PasswordHasher } from './password-hasher.js';
import type { RefreshTokenService } from './refresh-token.service.js';

const user: User = {
  id: 'u1',
  email: 'ana@example.com',
  passwordHash: 'stored-hash',
  displayName: 'Ana',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setup() {
  const users = {
    create: vi.fn().mockResolvedValue(user),
    findByEmailWithPassword: vi.fn().mockResolvedValue(user),
    findById: vi.fn().mockResolvedValue(user),
  };
  const hasher = {
    hash: vi.fn().mockResolvedValue('new-hash'),
    verify: vi.fn().mockResolvedValue(true),
  };
  const refreshTokens = {
    issue: vi.fn().mockResolvedValue('refresh-1'),
    rotate: vi
      .fn()
      .mockResolvedValue({ userId: 'u1', refreshToken: 'refresh-2' }),
    revoke: vi.fn(),
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('access-jwt') };
  const config = { get: vi.fn().mockReturnValue(900) };
  const service = new AuthService(
    users as unknown as UsersService,
    hasher as unknown as PasswordHasher,
    refreshTokens as unknown as RefreshTokenService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService<Env, true>,
  );
  return { service, users, hasher, jwt };
}

describe('AuthService', () => {
  it('hashes the password on register and never returns it', async () => {
    const { service, users } = setup();
    const result = await service.register({
      email: 'ana@example.com',
      password: 'secret123',
      displayName: 'Ana',
    });
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'new-hash' }),
    );
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result).toMatchObject({
      accessToken: 'access-jwt',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
  });

  it('puts only the user id in the access token', async () => {
    const { service, jwt } = setup();
    await service.login({ email: 'ana@example.com', password: 'secret123' });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1' });
  });

  it('rejects a wrong password', async () => {
    const { service, hasher } = setup();
    hasher.verify.mockResolvedValue(false);
    await expect(
      service.login({ email: 'ana@example.com', password: 'nope' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('still runs a hash check for unknown emails, so timing does not leak them', async () => {
    const { service, users, hasher } = setup();
    users.findByEmailWithPassword.mockResolvedValue(null);
    await expect(
      service.login({ email: 'ghost@example.com', password: 'x' }),
    ).rejects.toThrow('Invalid email or password');
    expect(hasher.verify).toHaveBeenCalledTimes(1);
  });

  it('returns the rotated refresh token on refresh', async () => {
    const { service } = setup();
    await expect(service.refresh('refresh-1')).resolves.toMatchObject({
      refreshToken: 'refresh-2',
      accessToken: 'access-jwt',
    });
  });
});
