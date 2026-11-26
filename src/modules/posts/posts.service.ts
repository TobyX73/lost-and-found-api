import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type FindOptionsWhere } from 'typeorm';
import { snapToGrid, toPoint } from '../../common/geo.js';
import { paginate, type Paginated, type Pagination } from '../../common/pagination.js';
import { CategoriesService } from '../categories/categories.service.js';
import { Post } from './post.entity.js';
import { toPostView, type PostView } from './post.view.js';
import type { CreatePostDto, ListPostsQuery, UpdatePostDto } from './posts.schemas.js';

const RELATIONS = { author: true, category: true } as const;

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    private readonly categories: CategoriesService,
  ) {}

  async create(authorId: string, dto: CreatePostDto): Promise<PostView> {
    await this.categories.assertExists(dto.categoryId);
    const { location, ...rest } = dto;
    const saved = await this.posts.save(
      this.posts.create({
        ...rest,
        authorId,
        locationLabel: rest.locationLabel ?? null,
        location: toPoint(location),
        publicLocation: toPoint(snapToGrid(location)),
      }),
    );
    return toPostView(await this.load(saved.id), authorId);
  }

  async findOne(id: string, viewerId?: string): Promise<PostView> {
    return toPostView(await this.load(id), viewerId);
  }

  async list(query: ListPostsQuery, viewerId?: string): Promise<Paginated<PostView>> {
    const where: FindOptionsWhere<Post> = { status: query.status };
    if (query.type) where.type = query.type;
    if (query.categoryId) where.categoryId = query.categoryId;
    return this.findPage(where, query, viewerId);
  }

  /** The author's own posts, in every status. */
  listMine(authorId: string, pagination: Pagination): Promise<Paginated<PostView>> {
    return this.findPage({ authorId }, pagination, authorId);
  }

  async update(id: string, userId: string, dto: UpdatePostDto): Promise<PostView> {
    // Loaded without relations: a loaded `category` would win over a changed `categoryId` on save.
    const post = await this.getOwned(id, userId);
    if (dto.categoryId !== undefined) await this.categories.assertExists(dto.categoryId);

    const { location, ...rest } = dto;
    Object.assign(post, rest);
    if (location) {
      post.location = toPoint(location);
      post.publicLocation = toPoint(snapToGrid(location));
    }
    await this.posts.save(post);
    return toPostView(await this.load(id), userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const post = await this.getOwned(id, userId);
    await this.posts.remove(post);
  }

  private async findPage(
    where: FindOptionsWhere<Post>,
    { page, limit }: Pagination,
    viewerId?: string,
  ): Promise<Paginated<PostView>> {
    const [rows, total] = await this.posts.findAndCount({
      where,
      relations: RELATIONS,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(
      rows.map((post) => toPostView(post, viewerId)),
      total,
      { page, limit },
    );
  }

  private async load(id: string): Promise<Post> {
    const post = await this.posts.findOne({ where: { id }, relations: RELATIONS });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private async getOwned(id: string, userId: string): Promise<Post> {
    const post = await this.posts.findOneBy({ id });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) {
      throw new ForbiddenException('Only the author can change this post');
    }
    return post;
  }
}
