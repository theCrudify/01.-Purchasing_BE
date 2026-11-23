import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { rateLimit } from '../../middleware/rate-limit'
import { passwordResetController as ctl } from './password-reset.controller'
import { resetComplete, resetRequest, resetVerify } from './password-reset.schema'

/** Public forgot-password: request code → verify code → set new password. */
export const passwordResetRoutes = new Hono<AppEnv>()
  .post('/request', rateLimit('pwreset-req', 5, 60_000), validate('json', resetRequest), (c) => ctl.request(c, c.req.valid('json')))
  .post('/verify', rateLimit('pwreset-chk', 10, 60_000), validate('json', resetVerify), (c) => ctl.verify(c, c.req.valid('json')))
  .post('/reset', rateLimit('pwreset-chk', 10, 60_000), validate('json', resetComplete), (c) => ctl.reset(c, c.req.valid('json')))
