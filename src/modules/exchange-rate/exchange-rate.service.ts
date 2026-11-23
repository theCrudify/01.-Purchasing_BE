import type { Db, SessionActor } from '../../core/db'
import type { Actor } from '../../core/types'
import { notFound } from '../../core/errors'
import { rule } from '../_master/shared'
import { ExchangeRateRepository } from './exchange-rate.repository'
import { parseKey, type RateCreate, type RateListQuery } from './exchange-rate.schema'

const FRANKFURTER = 'https://api.frankfurter.app/latest'

export class ExchangeRateService {
  constructor(private db: Db, private actor: Actor | SessionActor) {}
  private run<T>(fn: (r: ExchangeRateRepository) => Promise<T>) { return this.db.session(this.actor, (q) => fn(new ExchangeRateRepository(q))) }

  list(qs: RateListQuery) { return this.run((r) => r.list(qs)) }
  get(key: string) { return this.run(async (r) => (await r.get(parseKey(key))) ?? Promise.reject(notFound('Exchange rate'))) }

  create(d: RateCreate) {
    if (d.currencyCode === 'IDR') throw rule('IDR is the base currency (rate is always 1)')
    return this.run(async (r) => {
      if (!(await r.currencyActive(d.currencyCode))) throw rule('Currency is not active')
      await r.upsert(d, 'MANUAL', this.actor.id)
      return r.get(d)
    })
  }

  remove(key: string) {
    const k = parseKey(key)
    return this.run(async (r) => {
      if (await r.usedByDocuments(k)) throw rule('Rate is already used by documents and cannot be deleted')
      if (!(await r.remove(k))) throw notFound('Exchange rate')
      return k
    })
  }

  /**
   * Daily MIDDLE rates from Frankfurter (ECB reference, free, no key), converted to IDR per 1 unit.
   * shortcut: ECB reference ≠ BI kurs tengah; switch the source when a free BI feed is available.
   */
  async importLatest() {
    const codes = await this.run((r) => r.activeForeignCurrencies())
    if (!codes.length) return { date: null, inserted: 0, updated: 0, skipped: [] as string[] }
    const res = await fetch(`${FRANKFURTER}?from=IDR&to=${codes.join(',')}`)
    if (!res.ok) throw rule(`Rate provider error ${res.status}`)
    const body = (await res.json()) as { date: string; rates: Record<string, number> }
    return this.run(async (r) => {
      const logId = await r.startImport(body.date, this.actor.id)
      let inserted = 0, updated = 0
      for (const [code, perIdr] of Object.entries(body.rates)) {
        if (!(perIdr > 0)) continue
        const replaced = await r.upsert({ currencyCode: code, rateType: 'MIDDLE', rateDate: body.date, rateToBase: (1 / perIdr).toFixed(6) }, 'ECB', this.actor.id)
        replaced ? updated++ : inserted++
      }
      const skipped = codes.filter((c) => !(c in body.rates)) // not published by ECB
      await r.finishImport(logId, skipped.length ? 'PARTIAL' : 'SUCCESS', inserted, updated, skipped.length ? `Not available: ${skipped.join(',')}` : null)
      return { date: body.date, inserted, updated, skipped }
    })
  }
}
