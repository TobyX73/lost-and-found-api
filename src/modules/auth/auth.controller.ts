import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  type LoginDto,
  type RefreshDto,
  type RegisterDto,
} from './auth.schemas.js';
import { AuthService, type AuthResult, type AuthTokens } from './auth.service.js';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(
    @Body({ schema: registerSchema }) body: RegisterDto,
  ): Promise<AuthResult> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body({ schema: loginSchema }) body: LoginDto): Promise<AuthResult> {
    return this.auth.login(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body({ schema: refreshSchema }) body: RefreshDto,
  ): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body({ schema: refreshSchema }) body: RefreshDto): Promise<void> {
    return this.auth.logout(body.refreshToken);
  }
}
