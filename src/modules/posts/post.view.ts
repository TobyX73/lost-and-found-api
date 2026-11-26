import { fromPoint, PUBLIC_LOCATION_CELL_METERS, type LatLng } from '../../common/geo.js';
import type { Post, PostAttributes, PostStatus, PostType } from './post.entity.js';

/** What the API returns for a post. The exact location is only included for its author. */
export interface PostView {
  id: string;
  type: PostType;
  status: PostStatus;
  title: string;
  description: string;
  category: { id: number; slug: string; name: string };
  attributes: PostAttributes;
  occurredAt: Date;
  approximateLocation: LatLng;
  /** Never smaller than the grid cell, so it cannot hint at the exact spot. */
  approximateRadiusM: number;
  locationLabel: string | null;
  author: { id: string; displayName: string };
  isOwner: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Author only. */
  location?: LatLng;
  /** Author only. */
  radiusM?: number;
}

export function toPostView(post: Post, viewerId?: string): PostView {
  if (!post.author || !post.category) {
    throw new Error('toPostView needs the author and category relations loaded');
  }
  const isOwner = viewerId === post.authorId;
  const view: PostView = {
    id: post.id,
    type: post.type,
    status: post.status,
    title: post.title,
    description: post.description,
    category: {
      id: post.category.id,
      slug: post.category.slug,
      name: post.category.name,
    },
    attributes: post.attributes,
    occurredAt: post.occurredAt,
    approximateLocation: fromPoint(post.publicLocation),
    approximateRadiusM: Math.max(post.radiusM, PUBLIC_LOCATION_CELL_METERS),
    locationLabel: post.locationLabel,
    author: { id: post.author.id, displayName: post.author.displayName },
    isOwner,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
  if (isOwner) {
    view.location = fromPoint(post.location);
    view.radiusM = post.radiusM;
  }
  return view;
}
