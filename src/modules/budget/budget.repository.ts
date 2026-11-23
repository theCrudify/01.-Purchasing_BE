import type { Queryable } from '../../core/db'
import type { ListQuery } from '../../core/list-query'
import { ViewCrudRepository } from '../_master/shared'
import { budgetDef, budgetView } from './budget.schema'

type Row = Record<string, any>
export type Consumption = { poCommitted: string; prCommitted: string; available: string } | null

/** SQL only. Consumption comes from vw_budget_consumption (procurement / db-port) when that view exists. */
export class BudgetRepository extends ViewCrudRepository<Row> {
  constructor(q: Queryable) { super(q, budgetDef, budgetView) }

  private async withConsumption(rows: Row[]) {
    const ok = rows.length > 0 && (await this.q.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'vw_budget_consumption' AND column_name = 'BudgetId'`)).length > 0
    const map = new Map<number, Row>()
    if (ok) {
      for (const { v } of await this.q.query<{ v: Row }>(`SELECT to_jsonb(c) AS v FROM vw_budget_consumption c WHERE c."BudgetId" = ANY($1::int[])`, [rows.map((r) => r.id)])) map.set(Number(v.BudgetId), v)
    }
    // null = consumption unknown (view missing or budget inactive); the page shows "—"
    return rows.map((r) => {
      const v = map.get(r.id)
      return { ...r, consumption: v ? { poCommitted: String(v.PoCommitted ?? 0), prCommitted: String(v.PrCommitted ?? 0), available: String(v.Available ?? '') } : null }
    })
  }

  override async list(qs: ListQuery & Record<string, unknown>, deleted = false) {
    const page = await super.list(qs, deleted)
    return { ...page, data: await this.withConsumption(page.data) }
  }
  override async get(key: unknown) {
    const r = await super.get(key)
    return r && (await this.withConsumption([r]))[0]
  }

  async duplicate(d: Row, exceptId: number | null) {
    return (await this.q.query(
      `SELECT 1 FROM mst_budget WHERE "IsActive" AND NOT "IsDeleted" AND "FiscalYear"=$1 AND "DepartmentId"=$2
         AND "PurchaseClassId" IS NOT DISTINCT FROM $3 AND "Id" IS DISTINCT FROM $4 LIMIT 1`,
      [d.fiscalYear, d.departmentId, d.purchaseClassId ?? null, exceptId])).length > 0
  }
}
