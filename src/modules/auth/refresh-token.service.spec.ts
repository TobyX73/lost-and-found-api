import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { Env } from '../../config/env.schema.js';
import type { RefreshToken } from './refresh-token.entity.js';
import { hashToken, RefreshTokenService } from './refresh-token.service.js';

function setup(record: Partial<RefreshToken> | null, affected = 1) {
  const repo = {
    insert: vi.fn().mockResolvedValue(undefined),
    findOneBy: vi.fn().mockResolvedValue(record),
    update: vi.fn().mockResolvedValue({ affected }),
  };
  const config = { get: vi.fn().mockReturnValue(30) };
  const service = new RefreshTokenService(
    repo as unknown as Repository<RefreshToken>,
    config as unknown as ConfigService<Env, true>,
  );
  return { service, repo };
}

const valid = (): Partial<RefreshToken> => ({
  id: 't1',
  userId: 'u1',
  familyId: 'f1',
  expiresAt: new Date(Date.now() + 60_000),
  usedAt: null,
  revokedAt: null,
});

describe('RefreshTokenService', () => {
  it('stores only the hash of an issued token', async () => {
    const { service, repo } = setup(null);
    const token = await service.issue('u1');
    const inserted = repo.insert.mock.calls[0][0];
    expect(inserted.tokenHash).toBe(hashToken(token));
    expect(inserted.tokenHash).not.toContain(token);
    expect(inserted.userId).toBe('u1');
  });

  it('rotates a valid token within the same family', async () => {
    const { service, repo } = setup(valid());
    const result = await service.rotate('old');
    expect(result.userId).toBe('u1');
    expect(repo.insert.mock.calls[0][0].familyId).toBe('f1');
  });

  it('rejects unknown, revoked and expired tokens', async () => {
    await expect(setup(null).service.rotate('x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      setup({ ...valid(), revokedAt: new Date() }).service.rotate('x'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      setup({ ...valid(), expiresAt: new Date(Date.now() - 1) }).service.rotate(
        'x',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes the whole family when a spent token is reused', async () => {
    const { service, repo } = setup({ ...valid(), usedAt: new Date() }, 0);
    await expect(service.rotate('reused')).rejects.toThrow('reuse detected');
    expect(repo.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ familyId: 'f1' }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
    expect(repo.insert).not.toHaveBeenCalled();
  });
});
