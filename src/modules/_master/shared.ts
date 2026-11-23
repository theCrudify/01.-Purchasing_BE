import { z } from 'zod'
import { CrudRepository, type CrudDef } from '../../core/crud'
import type { Queryable } from '../../core/db'
import type { ListQuery } from '../../core/list-query'
import { HttpError } from '../../core/errors'

/** Shared zod pieces + view-backed repository for the master-data modules. */

export const code = (max: number) => z.string().trim().min(1).max(max).regex(/^[A-Za-z0-9._\/-]+$/, 'letters, digits, . _ / - only')
export const text = (max: number) => z.string().trim().min(1).max(max)
export const optText = (max: number) => z.string().trim().max(max).nullable().optional()
export const id = z.number().int().positive()
export const optId = id.nullable().optional()
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date')
export const ccy = z.string().trim().length(3).regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase())

/** Decimal as string (money never goes through JS floats): `intDigits` before the point, `scale` after. */
export const dec = (intDigits: number, scale: number, o: { min?: number; max?: number; gt?: number } = {}) =>
  z.union([z.string().trim(), z.number()]).transform(String)
    .pipe(z.string().regex(new RegExp(`^\\d{1,${intDigits}}(\\.\\d{1,${scale}})?$`), `number with at most ${intDigits} digits and ${scale} decimals`))
    .refine((s) => o.min === undefined || Number(s) >= o.min, `must be >= ${o.min}`)
    .refine((s) => o.max === undefined || Number(s) <= o.max, `must be <= ${o.max}`)
    .refine((s) => o.gt === undefined || Number(s) > o.gt, `must be > ${o.gt}`)

export const rule = (msg: string) => new HttpError(422, 'RULE_VIOLATION', msg)

export type ViewDef = { table: string; fields: Record<string, string>; searchable?: string[]; sortable?: Record<string, string> }

/** CRUD on the base table, but list/get read a join view so rows carry display names. */
export class ViewCrudRepository<Row = Record<string, unknown>> extends CrudRepository<Row> {
  constructor(q: Queryable, def: CrudDef, protected view: ViewDef) { super(q, def) }
  private get viewRepo() {
    const d = this.def, v = this.view
    return new CrudRepository<Row>(this.q, { ...d, table: v.table, fields: { ...d.fields, ...v.fields }, searchable: v.searchable ?? d.searchable, sortable: { ...d.sortable, ...v.sortable } })
  }
  private keyOf(row: any) { return row[Object.keys(this.def.fields).find((k) => this.def.fields[k] === this.def.key.col)!] }
  override list(qs: ListQuery & Record<string, unknown>, deleted = false) { return this.viewRepo.list(qs, deleted) }
  override get(key: unknown) { return this.viewRepo.get(key) }
  override async create(data: Record<string, unknown>, actorId: number | null) { return (await this.get(this.keyOf(await super.create(data, actorId))))! }
  override async update(key: unknown, data: Record<string, unknown>, actorId: number | null) {
    const r = await super.update(key, data, actorId)
    return r && this.get(this.keyOf(r))
  }

  /** active, not-deleted row exists in a master table (for FK targets that must be usable) */
  async usable(table: string, idv: unknown, extra = '') {
    if (idv == null) return true
    return (await this.q.query(`SELECT 1 FROM ${table} WHERE "Id"=$1 AND "IsActive" AND NOT "IsDeleted" ${extra}`, [idv])).length > 0
  }
}

/** Merge the PATCH body over the stored row so cross-field rules see the final values. */
export const merged = async <T extends Record<string, unknown>>(repo: { get(k: unknown): Promise<any> }, key: unknown, data: Record<string, unknown>) => {
  const cur = await repo.get(key)
  if (!cur) throw new HttpError(404, 'NOT_FOUND', 'Record not found')
  return { ...cur, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) } as T
}
