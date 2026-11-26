import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  OptionalUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { paginationSchema, type Paginated, type Pagination } from '../../common/pagination.js';
import type { PostView } from './post.view.js';
import {
  createPostSchema,
  listPostsQuerySchema,
  postIdSchema,
  updatePostSchema,
  type CreatePostDto,
  type ListPostsQuery,
  type UpdatePostDto,
} from './posts.schemas.js';
import { PostsService } from './posts.service.js';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Public()
  @Get()
  list(
    @Query({ schema: listPostsQuerySchema }) query: ListPostsQuery,
    @OptionalUser() user?: AuthUser,
  ): Promise<Paginated<PostView>> {
    return this.posts.list(query, user?.id);
  }

  // Declared before ':id' so "mine" is not parsed as an id.
  @Get('mine')
  mine(
    @CurrentUser() user: AuthUser,
    @Query({ schema: paginationSchema }) pagination: Pagination,
  ): Promise<Paginated<PostView>> {
    return this.posts.listMine(user.id, pagination);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id', { schema: postIdSchema }) id: string,
    @OptionalUser() user?: AuthUser,
  ): Promise<PostView> {
    return this.posts.findOne(id, user?.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createPostSchema }) body: CreatePostDto,
  ): Promise<PostView> {
    return this.posts.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: postIdSchema }) id: string,
    @Body({ schema: updatePostSchema }) body: UpdatePostDto,
  ): Promise<PostView> {
    return this.posts.update(id, user.id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: postIdSchema }) id: string,
  ): Promise<void> {
    return this.posts.remove(id, user.id);
  }
}
