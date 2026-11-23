import { z } from 'zod'
export const profileUpdate = z.object({
  displayName: z.string().trim().min(1).max(150).optional(),
  phone: z.string().trim().max(30).regex(/^[+0-9 ()-]*$/).nullable().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, 'Nothing to update')
export const passwordChange = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12, 'at least 12 characters').max(200).refine((p) => /[a-z]/i.test(p) && /\d/.test(p), 'must contain letters and digits'),
}).strict()
export type ProfileUpdate = z.infer<typeof profileUpdate>
export type PasswordChange = z.infer<typeof passwordChange>
