import { z } from 'zod';
import { paginationSchema } from '../../common/pagination.js';
import { POST_STATUSES, POST_TYPES } from './post.entity.js';

/** Small tolerance for client clocks that run slightly ahead. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const attributeValue = z.string().trim().toLowerCase().min(1).max(40).optional();

export const locationSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const attributesSchema = z.strictObject({
  color: attributeValue,
  brand: attributeValue,
  model: attributeValue,
  size: attributeValue,
});

const occurredAtSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .refine((date) => date.getTime() <= Date.now() + FUTURE_TOLERANCE_MS, {
    message: 'cannot be in the future',
  });

// Fields shared by create and update, without defaults: a default inside .partial()
// would silently overwrite stored values on every PATCH.
const editableFields = {
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  categoryId: z.number().int().positive(),
  attributes: attributesSchema,
  occurredAt: occurredAtSchema,
  location: locationSchema,
  radiusM: z.number().int().min(10).max(5000),
  locationLabel: z.string().trim().min(1).max(120).nullable(),
};

export const createPostSchema = z.strictObject({
  type: z.enum(POST_TYPES),
  ...editableFields,
  attributes: attributesSchema.default({}),
  radiusM: editableFields.radiusM.default(100),
  locationLabel: editableFields.locationLabel.optional(),
});
export type CreatePostDto = z.infer<typeof createPostSchema>;

export const updatePostSchema = z
  .strictObject({
    ...editableFields,
    // MATCHED and EXPIRED are set by the system, never by hand.
    status: z.enum(['OPEN', 'RESOLVED']),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'provide at least one field to update',
  });
export type UpdatePostDto = z.infer<typeof updatePostSchema>;

export const listPostsQuerySchema = paginationSchema.extend({
  type: z.enum(POST_TYPES).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: z.enum(POST_STATUSES).default('OPEN'),
});
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

export const postIdSchema = z.uuid();
