import { z } from 'zod'
import type { Paged } from './types'
import type { Queryable } from './db'

/** Shared query-string contract for every list endpoint: ?page=&pageSize=&q=&sort=name:asc,code:desc */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  sort: z.string().max(100).optional(),
})
export type ListQuery = z.infer<typeof listQuerySchema>

export type ListConfig = {
  table: string
  alias?: string
  /** API field -> quoted-safe column name. Only these are returned. */
  select: Record<string, string>
  /** Columns matched by ?q= (every token must hit at least one column). Back them with a pg_trgm GIN index. */
  searchable: string[]
  /** API sort key -> column. Anything else is rejected, so no SQL injection through ?sort. */
  sortable: Record<string, string>
  defaultSort: string // e.g. 'name:asc'
  /** Always-applied predicates, e.g. ['"IsDeleted" = false']. Use $n placeholders only via extraParams. */
  where?: string[]
  /** Unique column used as tiebreaker so pages are stable. */
  tiebreaker: string
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
const ident = (s: string) => { if (!IDENT.test(s)) throw new Error(`bad identifier ${s}`); return `"${s}"` }
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => '\\' + m)

export function parseSort(raw: string | undefined, cfg: ListConfig): { col: string; dir: 'ASC' | 'DESC' }[] {
  const items = (raw || cfg.defaultSort).split(',').slice(0, 3)
  return items.map((it) => {
    const [key = '', d = 'asc'] = it.trim().split(':')
    const col = cfg.sortable[key]
    if (!col || !['asc', 'desc'].includes(d.toLowerCase())) throw Object.assign(new Error(`Invalid sort "${it}"`), { badSort: true })
    return { col, dir: d.toLowerCase() === 'desc' ? 'DESC' : 'ASC' } as const
  })
}

export function buildListSql(cfg: ListConfig, qs: ListQuery, extra: { where?: string[]; params?: unknown[] } = {}) {
  const a = cfg.alias ?? 't'
  const params: unknown[] = [...(extra.params ?? [])]
  const where = [...(cfg.where ?? []), ...(extra.where ?? [])]
  const tokens = (qs.q ?? '').split(/\s+/).filter(Boolean).slice(0, 5)
  for (const tok of tokens) {
    params.push(`%${escapeLike(tok.toLowerCase())}%`)
    where.push('(' + cfg.searchable.map((c) => `lower(${a}.${ident(c)}::text) LIKE $${params.length}`).join(' OR ') + ')')
  }
  const order = [...parseSort(qs.sort, cfg).map((s) => `${a}.${ident(s.col)} ${s.dir}`), `${a}.${ident(cfg.tiebreaker)} ASC`].join(', ')
  const cols = Object.entries(cfg.select).map(([k, c]) => `${a}.${ident(c)} AS ${ident(k)}`).join(', ')
  const w = where.length ? ` WHERE ${where.join(' AND ')}` : ''
  const from = `FROM ${ident(cfg.table)} ${a}${w}`
  params.push(qs.pageSize, (qs.page - 1) * qs.pageSize)
  const sql = `SELECT ${cols}, COUNT(*) OVER() AS "_total" ${from} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`
  const countSql = `SELECT COUNT(*)::int AS n ${from}`
  return { sql, params, countSql, countParams: params.slice(0, -2) }
}

/** One round-trip for data + total (window count). Extra count query only when the page is past the end. */
export async function runList<T>(q: Queryable, cfg: ListConfig, qs: ListQuery, extra?: { where?: string[]; params?: unknown[] }): Promise<Paged<T>> {
  const b = buildListSql(cfg, qs, extra)
  const rows = await q.query<T & { _total: string | number }>(b.sql, b.params)
  let total = rows.length ? Number(rows[0]!._total) : 0
  if (!rows.length && qs.page > 1) total = Number((await q.query<{ n: number }>(b.countSql, b.countParams))[0]?.n ?? 0)
  const data = rows.map(({ _total, ...r }) => r as unknown as T)
  return { data, meta: { page: qs.page, pageSize: qs.pageSize, total, totalPages: Math.max(1, Math.ceil(total / qs.pageSize)) } }
}
