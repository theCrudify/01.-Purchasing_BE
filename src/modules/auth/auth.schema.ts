import { z } from 'zod'
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(200) })
export type LoginInput = z.infer<typeof loginSchema>

/** Password policy shared by change-password, reset and invitations. */
export const newPassword = z.string().min(4, 'At least 4 characters').max(200)
export const entraStartSchema = z.object({ next: z.string().max(500).optional() })
export const entraCallbackSchema = z.object({ code: z.string().max(4000).optional(), state: z.string().max(200).optional(), error: z.string().max(200).optional(), error_description: z.string().max(2000).optional(), session_state: z.string().max(200).optional() })
