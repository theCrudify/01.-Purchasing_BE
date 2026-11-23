import type { Db } from '../../core/db'
import type { Config } from '../../env'
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service'
import { dispatchQueued } from '../notification/notification.service'
import { CronRepository } from './cron.repository'

const SYSTEM = { id: null, userType: 'SYSTEM' } as const

export class CronService {
  constructor(private db: Db, private cfg: Config) {}
  dispatch() { return dispatchQueued(this.db, this.cfg, 100) }
  cleanup() {
    return this.db.session(SYSTEM, async (q) => {
      const r = new CronRepository(q)
      return { sessionsExpired: await r.expireSessions(), mailsRequeued: await r.requeueStuckMails(), codesPurged: await r.purgeOldCodes() }
    })
  }
  /** One daily entry point (Vercel Hobby allows only daily crons): housekeeping, rates, then e-mail. Each part fails on its own. */
  async daily() {
    const part = async <T>(fn: () => Promise<T>) => fn().catch((e) => ({ error: (e as Error).message }))
    return {
      cleanup: await part(() => this.cleanup()),
      rates: await part(() => new ExchangeRateService(this.db, SYSTEM).importLatest()),
      dispatch: await part(() => this.dispatch()),
    }
  }
}
