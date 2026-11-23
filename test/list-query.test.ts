import { describe, expect, it } from 'vitest'
import { buildListSql, listQuerySchema, runList, type ListConfig } from '../src/core/list-query'

const cfg: ListConfig = { table: 'mst_department', select: { id: 'Id', name: 'Name' }, searchable: ['Code', 'Name'], sortable: { name: 'Name' }, defaultSort: 'name:asc', tiebreaker: 'Id', where: ['t."IsDeleted" = false'] }
const qs = (o: object) => listQuerySchema.parse(o)

describe('list query builder', () => {
  it('paginates, sorts with tiebreaker, and parameterises search', () => {
    const b = buildListSql(cfg, qs({ page: 3, pageSize: 10, q: 'it dept' }))
    expect(b.sql).toContain('ORDER BY t."Name" ASC, t."Id" ASC')
    expect(b.sql).toContain('LIMIT $3 OFFSET $4')
    expect(b.params).toEqual(['%it%', '%dept%', 10, 20])
    expect(b.sql).not.toContain('dept')
  })
  it('escapes LIKE wildcards', () => { expect(buildListSql(cfg, qs({ q: '50%_' })).params[0]).toBe('%50\\%\\_%') })
  it('rejects unknown sort columns (injection)', () => { expect(() => buildListSql(cfg, qs({ sort: 'name;drop table x:asc' }))).toThrow() })
  it('caps pageSize', () => { expect(() => qs({ pageSize: 1000 })).toThrow() })
  it('returns total from the window count', async () => {
    const q = { query: async () => [{ id: 1, name: 'a', _total: '42' }] as any }
    const r = await runList<{ id: number }>(q, cfg, qs({ pageSize: 20 }))
    expect(r.meta).toEqual({ page: 1, pageSize: 20, total: 42, totalPages: 3 })
    expect(r.data[0]).toEqual({ id: 1, name: 'a' })
  })
})
