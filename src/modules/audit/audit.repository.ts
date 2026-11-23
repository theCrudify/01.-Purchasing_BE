import type { Queryable } from '../../core/db'
import { runList } from '../../core/list-query'
import { AUDIT_LISTS, type AuditKind, type AuditListQuery } from './audit.schema'

/** SQL only. Date range uses the time column of each view (OccurredAt / StartedAt), both indexed. */
export class AuditRepository {
  constructor(private q: Queryable) {}
  list(kind: AuditKind, qs: AuditListQuery) {
    const { cfg, filters } = AUDIT_LISTS[kind]
    const time = kind === 'sessions' ? 'StartedAt' : 'OccurredAt'
    const where: string[] = [], params: unknown[] = []
    for (const [f, col] of Object.entries(filters)) {
      const v = (qs as Record<string, unknown>)[f]
      if (v !== undefined && v !== '') { params.push(f === 'isActive' ? v === 'true' : v); where.push(`t."${col}" = $${params.length}`) }
    }
    if (qs.from) { params.push(qs.from); where.push(`t."${time}" >= $${params.length}::date`) }
    if (qs.to) { params.push(qs.to); where.push(`t."${time}" < $${params.length}::date + 1`) }
    return runList(this.q, cfg, qs, { where, params })
  }
}
