import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { clientIp } from '../security/security.middleware'
import { PasswordResetService } from './password-reset.service'

/** Run work after the response (waitUntil on Workers, fire-and-forget on Node). */
export { deferOf } from '../../core/defer'
import { deferOf } from '../../core/defer'
const svc = (c: Context<AppEnv>) => new PasswordResetService(c.get('db'), c.get('cfg'), deferOf(c))

export const passwordResetController = {
  request: async (c: Context<AppEnv>, b: { email: string }) => c.json({ data: await svc(c).request(b.email, clientIp(c)) }),
  verify: async (c: Context<AppEnv>, b: { email: string; code: string }) => c.json({ data: await svc(c).verify(b.email, b.code) }),
  reset: async (c: Context<AppEnv>, b: { email: string; code: string; newPassword: string }) => c.json({ data: await svc(c).reset(b, clientIp(c)) }),
}
