import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import type { Env } from '../../config/env.schema.js';
import { RefreshToken } from './refresh-token.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Issues a token; pass `familyId` to continue a rotation chain, omit it for a new sign-in. */
  async issue(userId: string, familyId: string = randomUUID()): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    await this.tokens.insert({
      userId,
      familyId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
    });
    return token;
  }

  /**
   * Spends a refresh token and returns a new one in the same family.
   * Presenting an already spent token is treated as theft: the whole family is revoked.
   */
  async rotate(token: string): Promise<{ userId: string; refreshToken: string }> {
    const record = await this.tokens.findOneBy({ tokenHash: hashToken(token) });
    if (!record || record.revokedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Conditional update so two concurrent refreshes cannot both spend the same token.
    const spent = await this.tokens.update(
      { id: record.id, usedAt: IsNull(), revokedAt: IsNull() },
      { usedAt: new Date() },
    );
    if (spent.affected !== 1) {
      await this.revokeFamily(record.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    return {
      userId: record.userId,
      refreshToken: await this.issue(record.userId, record.familyId),
    };
  }

  /** Revokes the family the token belongs to (logout). Unknown tokens are ignored. */
  async revoke(token: string): Promise<void> {
    const record = await this.tokens.findOneBy({ tokenHash: hashToken(token) });
    if (record) await this.revokeFamily(record.familyId);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.tokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
