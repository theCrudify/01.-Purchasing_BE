import { z } from 'zod'
import { newPassword } from '../auth/auth.schema'

const email = z.string().trim().toLowerCase().email().max(254)
const code = z.string().trim().regex(/^\d{6}$/, '6-digit code')
export const resetRequest = z.object({ email }).strict()
export const resetVerify = z.object({ email, code }).strict()
export const resetComplete = z.object({ email, code, newPassword }).strict()
export type ResetComplete = z.infer<typeof resetComplete>
