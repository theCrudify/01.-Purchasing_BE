import { Hono, type Context } from 'hono'
import { validate } from './validate'
import { z, type ZodTypeAny } from 'zod'
import type { AppEnv } from '../env'
import type { Db, Queryable } from './db'
import type { Actor, Paged } from './types'
import { forbidden, notFound } from './errors'
import { listQuerySchema, runList, type ListConfig, type ListQuery } from './list-query'
import { requireAuth, requirePermission, requireUserType } from '../middleware/auth'

/**
 * Config-driven base for the master tables. Every module still has its own
 * routes / controller / service / repository / schema files; they extend these bases and add their own rules.
 */
export type CrudDef = {
  name: string // human label for errors
  table: string
  key: { col: string; type: 'int' | 'uuid' | 'code' } // what appears in the URL (PublicId when the table has one)
  pk?: string // internal PK column used as sort tiebreaker (default 'Id')
  fields: Record<string, string> // api field -> column (all selectable)
  searchable: string[] // columns; each needs a pg_trgm index
  sortable: Record<string, string>
  defaultSort: string
  softDelete: boolean // table has IsDeleted / DeletedAt / DeletedBy
  hasActive?: boolean // table has IsActive (default true)
  audit?: boolean // table has CreatedBy / UpdatedBy (default true)
  hasUpdatedAt?: boolean // default true
  filters?: Record<string, string> // extra exact-match ?filter=value -> column
  where?: string[] // fixed predicates on alias t
}

const qi = (c: string) => `"${c}"`
const keySchema = (t: CrudDef['key']['type']) =>
  t === 'int' ? z.coerce.number().int().positive() : t === 'uuid' ? z.string().uuid() : z.string().trim().min(1).max(50)

export class CrudRepository<Row = Record<string, unknown>> {
  constructor(protected q: Queryable, protected def: CrudDef) {}
  protected get cols() { return Object.entries(this.def.fields).map(([k, c]) => `${qi(c)} AS ${qi(k)}`).join(',') }
  protected toCols(data: Record<string, unknown>): [string, unknown][] {
    return Object.entries(data).filter(([k, v]) => v !== undefined && this.def.fields[k]).map(([k, v]) => [this.def.fields[k]!, v])
  }

  list(qs: ListQuery & Record<string, unknown>, deleted = false): Promise<Paged<Row>> {
    const d = this.def
    const where = [...(d.where ?? [])]
    const params: unknown[] = []
    if (d.softDelete) where.push(`t."IsDeleted" = ${deleted}`)
    if ((d.hasActive ?? true) && qs.isActive !== undefined) { params.push(qs.isActive === 'true'); where.push(`t."IsActive" = $${params.length}`) }
    for (const [f, col] of Object.entries(d.filters ?? {})) {
      if (qs[f] !== undefined && qs[f] !== '') { params.push(qs[f]); where.push(`t.${qi(col)}::text = $${params.length}`) }
    }
    const cfg: ListConfig = { table: d.table, select: d.fields, searchable: d.searchable, sortable: d.sortable, defaultSort: d.defaultSort, tiebreaker: d.pk ?? 'Id' }
    return runList<Row>(this.q, cfg, qs, { where, params })
  }

  async get(key: unknown) {
    return (await this.q.query<Row>(`SELECT ${this.cols} FROM ${qi(this.def.table)} WHERE ${qi(this.def.key.col)} = $1`, [key]))[0]
  }

  async create(data: Record<string, unknown>, actorId: number | null) {
    const pairs = this.toCols(data)
    if (this.def.audit ?? true) pairs.push(['CreatedBy', actorId], ['UpdatedBy', actorId])
    return (await this.q.query<Row>(
      `INSERT INTO ${qi(this.def.table)} (${pairs.map(([c]) => qi(c)).join(',')}) VALUES (${pairs.map((_, i) => `$${i + 1}`).join(',')}) RETURNING ${this.cols}`,
      pairs.map(([, v]) => v)))[0]!
  }

  async update(key: unknown, data: Record<string, unknown>, actorId: number | null) {
    const pairs = this.toCols(data)
    if (this.def.audit ?? true) pairs.push(['UpdatedBy', actorId])
    const sets = pairs.map(([c], i) => `${qi(c)}=$${i + 2}`)
    if (this.def.hasUpdatedAt ?? true) sets.push(`"UpdatedAt"=now()`)
    const guard = this.def.softDelete ? ' AND NOT "IsDeleted"' : ''
    return (await this.q.query<Row>(
      `UPDATE ${qi(this.def.table)} SET ${sets.join(',')} WHERE ${qi(this.def.key.col)}=$1${guard} RETURNING ${this.cols}`,
      [key, ...pairs.map(([, v]) => v)]))[0]
  }

  async setDeleted(key: unknown, deleted: boolean, actorId: number | null) {
    const t = qi(this.def.table), k = qi(this.def.key.col)
    const active = (this.def.hasActive ?? true) ? ',"IsActive"=false' : ''
    const sql = deleted
      ? `UPDATE ${t} SET "IsDeleted"=true${active},"DeletedAt"=now(),"DeletedBy"=$2 WHERE ${k}=$1 AND NOT "IsDeleted" RETURNING ${this.cols}`
      : `UPDATE ${t} SET "IsDeleted"=false,"DeletedAt"=NULL,"DeletedBy"=NULL WHERE ${k}=$1 AND "IsDeleted" RETURNING ${this.cols}`
    return (await this.q.query<Row>(sql, deleted ? [key, actorId] : [key]))[0]
  }
}

export type Hooks<R> = {
  beforeCreate?: (repo: R, data: Record<string, unknown>, actor: Actor) => Promise<void>
  beforeUpdate?: (repo: R, key: unknown, data: Record<string, unknown>, actor: Actor) => Promise<void>
  beforeDelete?: (repo: R, key: unknown, actor: Actor) => Promise<void>
}

export class CrudService<R extends CrudRepository<any>> {
  constructor(protected db: Db, protected actor: Actor, protected make: (q: Queryable) => R, protected def: CrudDef, protected hooks: Hooks<R> = {}) {}
  protected run<T>(fn: (r: R) => Promise<T>) { return this.db.session(this.actor, (q) => fn(this.make(q))) }
  protected found<T>(v: T | undefined, what = this.def.name): T { if (v === undefined) throw notFound(what); return v }

  list(qs: ListQuery & Record<string, unknown>) {
    const deleted = qs.deleted === 'true'
    if (deleted && !this.actor.permissions.has('MASTER.VIEW_DELETED')) throw forbidden('Requires MASTER.VIEW_DELETED')
    return this.run((r) => r.list(qs, deleted))
  }
  get(key: unknown) { return this.run(async (r) => this.found(await r.get(key))) }
  create(data: Record<string, unknown>) {
    return this.run(async (r) => { await this.hooks.beforeCreate?.(r, data, this.actor); return r.create(data, this.actor.id) })
  }
  update(key: unknown, data: Record<string, unknown>) {
    return this.run(async (r) => { await this.hooks.beforeUpdate?.(r, key, data, this.actor); return this.found(await r.update(key, data, this.actor.id)) })
  }
  remove(key: unknown) {
    return this.run(async (r) => { await this.hooks.beforeDelete?.(r, key, this.actor); return this.found(await r.setDeleted(key, true, this.actor.id)) })
  }
  restore(key: unknown) { return this.run(async (r) => this.found(await r.setDeleted(key, false, this.actor.id), `Deleted ${this.def.name}`)) }
}

export type ServiceFactory = (c: Context<AppEnv>) => CrudService<any>

/** Standard controller: HTTP in/out only. */
export const crudController = (svc: ServiceFactory) => ({
  list: async (c: Context<AppEnv>, qs: any) => c.json(await svc(c).list(qs)),
  get: async (c: Context<AppEnv>, key: unknown) => c.json({ data: await svc(c).get(key) }),
  create: async (c: Context<AppEnv>, body: any) => c.json({ data: await svc(c).create(body) }, 201),
  update: async (c: Context<AppEnv>, key: unknown, body: any) => c.json({ data: await svc(c).update(key, body) }),
  remove: async (c: Context<AppEnv>, key: unknown) => c.json({ data: await svc(c).remove(key) }),
  restore: async (c: Context<AppEnv>, key: unknown) => c.json({ data: await svc(c).restore(key) }),
})

export function crudListQuery(def: CrudDef) {
  const extra: Record<string, ZodTypeAny> = { isActive: z.enum(['true', 'false']).optional(), deleted: z.enum(['true', 'false']).optional() }
  for (const f of Object.keys(def.filters ?? {})) extra[f] = z.string().max(100).optional()
  return listQuerySchema.extend(extra)
}

export type CrudPerms = { view: string; manage: string; delete?: string }
const MASTER_PERMS: CrudPerms = { view: 'MASTER.VIEW', manage: 'MASTER.MANAGE', delete: 'MASTER.DELETE' }

/** Standard routes: GET /, GET /:key, POST /, PATCH /:key, DELETE /:key, POST /:key/restore. Returns the router so modules can add more. */
export function crudRoutes(def: CrudDef, ctl: ReturnType<typeof crudController>, schemas: { create: z.ZodObject<any>; update?: ZodTypeAny }, perms: CrudPerms = MASTER_PERMS) {
  const param = z.object({ key: keySchema(def.key.type) })
  const update = schemas.update ?? schemas.create.partial().strict().refine((v: object) => Object.keys(v).length > 0, 'Nothing to update')
  const r = new Hono<AppEnv>()
  r.use(requireAuth, requireUserType('INTERNAL'))
  r.get('/', requirePermission(perms.view), validate('query', crudListQuery(def)), (c) => ctl.list(c, c.req.valid('query')))
  r.get('/:key', requirePermission(perms.view), validate('param', param), (c) => ctl.get(c, c.req.valid('param').key))
  r.post('/', requirePermission(perms.manage), validate('json', schemas.create.strict()), (c) => ctl.create(c, c.req.valid('json')))
  r.patch('/:key', requirePermission(perms.manage), validate('param', param), validate('json', update), (c) => ctl.update(c, c.req.valid('param').key, c.req.valid('json') as any))
  if (def.softDelete && perms.delete) {
    r.delete('/:key', requirePermission(perms.delete), validate('param', param), (c) => ctl.remove(c, c.req.valid('param').key))
    r.post('/:key/restore', requirePermission(perms.delete), validate('param', param), (c) => ctl.restore(c, c.req.valid('param').key))
  }
  return r
}
