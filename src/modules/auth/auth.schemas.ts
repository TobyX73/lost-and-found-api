import { z } from 'zod';
import { displayNameSchema } from '../users/users.schemas.js';

const emailSchema = z.email().max(254);
// Upper bound keeps scrypt input reasonable and blocks very long-password DoS.
const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.strictObject({
  refreshToken: z.string().min(1).max(256),
});
export type RefreshDto = z.infer<typeof refreshSchema>;
