import type { Queryable } from '../../core/db'
import { runList } from '../../core/list-query'
import { rateList, type RateCreate, type RateListQuery } from './exchange-rate.schema'

const COLS = `"Key" AS key,"CurrencyCode" AS "currencyCode","CurrencyName" AS "currencyName","RateType" AS "rateType","RateDate" AS "rateDate","RateToBase" AS "rateToBase","Source" AS source,"CreatedAt" AS "createdAt"`

/** SQL only. */
export class ExchangeRateRepository {
  constructor(private q: Queryable) {}

  list(qs: RateListQuery) {
    const where: string[] = [], params: unknown[] = []
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)) }
    if (qs.currencyCode) add('t."CurrencyCode" = ?', qs.currencyCode)
    if (qs.rateType) add('t."RateType" = ?', qs.rateType)
    if (qs.from) add('t."RateDate" >= ?::date', qs.from)
    if (qs.to) add('t."RateDate" <= ?::date', qs.to)
    return runList(this.q, rateList, qs, { where, params })
  }
  async get(k: { currencyCode: string; rateType: string; rateDate: string }) {
    return (await this.q.query(`SELECT ${COLS} FROM vw_exchange_rate WHERE "CurrencyCode"=$1 AND "RateType"=$2 AND "RateDate"=$3::date`, [k.currencyCode, k.rateType, k.rateDate]))[0]
  }
  async currencyActive(code: string) {
    return (await this.q.query(`SELECT 1 FROM mst_currency WHERE "Code"=$1 AND "IsActive"`, [code])).length > 0
  }
  async activeForeignCurrencies() {
    return (await this.q.query<{ code: string }>(`SELECT "Code" AS code FROM mst_currency WHERE "IsActive" AND "Code" <> 'IDR' AND NOT "IsFund"`)).map((r) => r.code)
  }
  /** insert or overwrite; returns true when a row was replaced */
  async upsert(r: RateCreate, source: string, actorId: number | null) {
    const [x] = await this.q.query<{ inserted: boolean }>(
      `INSERT INTO mst_exchange_rate ("CurrencyCode","RateType","RateDate","RateToBase","Source","CreatedBy") VALUES ($1,$2,$3::date,$4,$5,$6)
       ON CONFLICT ("CurrencyCode","RateType","RateDate") DO UPDATE SET "RateToBase"=EXCLUDED."RateToBase","Source"=EXCLUDED."Source"
       RETURNING (xmax = 0) AS inserted`, [r.currencyCode, r.rateType, r.rateDate, r.rateToBase, source, actorId])
    return !x!.inserted
  }
  /** a document snapshotted this exact rate row (same currency + rate date) */
  async usedByDocuments(k: { currencyCode: string; rateDate: string }) {
    return (await this.q.query(`SELECT 1 FROM tr_document WHERE "CurrencyCode"=$1 AND "ExchangeRateDate"=$2::date LIMIT 1`, [k.currencyCode, k.rateDate])).length > 0
  }
  async remove(k: { currencyCode: string; rateType: string; rateDate: string }) {
    return (await this.q.query(`DELETE FROM mst_exchange_rate WHERE "CurrencyCode"=$1 AND "RateType"=$2 AND "RateDate"=$3::date RETURNING 1`, [k.currencyCode, k.rateType, k.rateDate])).length > 0
  }
  async startImport(date: string, actorId: number | null) {
    return (await this.q.query<{ id: number }>(`INSERT INTO hist_rate_import ("Source","RateType","EffectiveDate","TriggeredBy") VALUES ('ECB','MIDDLE',$1::date,$2) RETURNING "Id" AS id`, [date, actorId]))[0]!.id
  }
  finishImport(id: number, status: string, inserted: number, updated: number, error: string | null) {
    return this.q.query(`UPDATE hist_rate_import SET "FinishedAt"=now(),"Status"=$2,"RowsInserted"=$3,"RowsUpdated"=$4,"ErrorMessage"=$5 WHERE "Id"=$1`, [id, status, inserted, updated, error?.slice(0, 2000) ?? null])
  }
}
