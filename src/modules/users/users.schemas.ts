import { z } from 'zod';

export const displayNameSchema = z.string().trim().min(2).max(50);

export const updateMeSchema = z.strictObject({
  displayName: displayNameSchema,
});
export type UpdateMeDto = z.infer<typeof updateMeSchema>;
