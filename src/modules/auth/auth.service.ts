import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema.js';
import { toPublicUser, type PublicUser, type User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { LoginDto, RegisterDto } from './auth.schemas.js';
import { PasswordHasher } from './password-hasher.js';
import { RefreshTokenService } from './refresh-token.service.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

export interface AuthResult extends AuthTokens {
  user: PublicUser;
}

export interface AccessTokenPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  /** Checked when the email is unknown, so response time does not reveal which emails exist. */
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly refreshTokens: RefreshTokenService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.users.create({
      email: dto.email,
      displayName: dto.displayName,
      passwordHash: await this.hasher.hash(dto.password),
    });
    return this.signIn(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (!user) {
      this.dummyHash ??= this.hasher.hash('dummy-password-for-timing');
      await this.hasher.verify(dto.password, await this.dummyHash);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!(await this.hasher.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.signIn(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const rotated = await this.refreshTokens.rotate(refreshToken);
    const user = await this.users.findById(rotated.userId);
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    return this.buildTokens(user.id, rotated.refreshToken);
  }

  logout(refreshToken: string): Promise<void> {
    return this.refreshTokens.revoke(refreshToken);
  }

  private async signIn(user: User): Promise<AuthResult> {
    const refreshToken = await this.refreshTokens.issue(user.id);
    return {
      user: toPublicUser(user),
      ...(await this.buildTokens(user.id, refreshToken)),
    };
  }

  private async buildTokens(
    userId: string,
    refreshToken: string,
  ): Promise<AuthTokens> {
    const payload: AccessTokenPayload = { sub: userId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
    };
  }
}
