import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator.js';
import { toPublicUser, type PublicUser } from './user.entity.js';
import { updateMeSchema, type UpdateMeDto } from './users.schemas.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return toPublicUser(await this.usersService.getById(user.id));
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body({ schema: updateMeSchema }) body: UpdateMeDto,
  ): Promise<PublicUser> {
    return toPublicUser(
      await this.usersService.updateDisplayName(user.id, body.displayName),
    );
  }
}
