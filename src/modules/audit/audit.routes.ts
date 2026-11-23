import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth, requirePermission, requireUserType } from '../../middleware/auth'
import { ipAllowList } from '../security/security.middleware'
import { auditController as ctl } from './audit.controller'
import { auditKind, auditListQuery } from './audit.schema'

/** GET /api/audit/{logs|activity|access|sessions} */
export const auditRoutes = new Hono<AppEnv>()
  .use(ipAllowList, requireAuth, requireUserType('INTERNAL'), requirePermission('AUDIT.VIEW'))
  .get('/:kind', validate('param', auditKind), validate('query', auditListQuery), (c) => ctl.list(c, c.req.valid('param').kind, c.req.valid('query')))
