import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Point,
} from 'typeorm';
import { Category } from '../categories/category.entity.js';
import { User } from '../users/user.entity.js';

export const POST_TYPES = ['LOST', 'FOUND'] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_STATUSES = ['OPEN', 'MATCHED', 'RESOLVED', 'EXPIRED'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** Normalised (lower-case) descriptive attributes, used later by the matching algorithm. */
export interface PostAttributes {
  color?: string;
  brand?: string;
  model?: string;
  size?: string;
}

@Entity({ name: 'posts' })
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author?: User;

  @Column({ type: 'enum', enum: POST_TYPES, enumName: 'post_type' })
  type: PostType;

  @Column({ type: 'enum', enum: POST_STATUSES, enumName: 'post_status', default: 'OPEN' })
  status: PostStatus;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'category_id', type: 'smallint' })
  categoryId: number;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  @Column({ type: 'jsonb', default: {} })
  attributes: PostAttributes;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  /** Exact location. Private: only the author ever sees it. */
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: Point;

  /** Location snapped to a ~300 m grid. This is what everyone else sees. */
  @Column({
    name: 'public_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  publicLocation: Point;

  @Column({ name: 'radius_m', type: 'integer' })
  radiusM: number;

  @Column({ name: 'location_label', type: 'varchar', length: 120, nullable: true })
  locationLabel: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
