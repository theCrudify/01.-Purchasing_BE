import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth } from '../../middleware/auth'
import { rateLimit } from '../../middleware/rate-limit'
import { profileController as ctl } from './profile.controller'
import { passwordChange, profileUpdate } from './profile.schema'

/** /api/profile — the signed-in user's own data only (no ids in the URL → no IDOR surface). */
export const profileRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', (c) => ctl.get(c))
  .patch('/', validate('json', profileUpdate), (c) => ctl.update(c, c.req.valid('json')))
  .post('/password', rateLimit('pwchange', 5, 60_000), validate('json', passwordChange), (c) => ctl.changePassword(c, c.req.valid('json')))
  .get('/signature', (c) => ctl.signature(c))
  .post('/signature', (c) => ctl.uploadSignature(c))
