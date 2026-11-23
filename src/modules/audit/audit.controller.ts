import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { AuditService } from './audit.service'
import type { AuditKind, AuditListQuery } from './audit.schema'

export const auditController = {
  list: async (c: Context<AppEnv>, kind: AuditKind, qs: AuditListQuery) => c.json(await new AuditService(c.get('db'), c.get('actor')).list(kind, qs)),
}
