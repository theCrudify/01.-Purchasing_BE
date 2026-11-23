import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { ExchangeRateService } from './exchange-rate.service'
import type { RateCreate, RateListQuery } from './exchange-rate.schema'

const svc = (c: Context<AppEnv>) => new ExchangeRateService(c.get('db'), c.get('actor'))

export const exchangeRateController = {
  list: async (c: Context<AppEnv>, qs: RateListQuery) => c.json(await svc(c).list(qs)),
  get: async (c: Context<AppEnv>, key: string) => c.json({ data: await svc(c).get(key) }),
  create: async (c: Context<AppEnv>, d: RateCreate) => c.json({ data: await svc(c).create(d) }, 201),
  remove: async (c: Context<AppEnv>, key: string) => c.json({ data: await svc(c).remove(key) }),
  importLatest: async (c: Context<AppEnv>) => c.json({ data: await svc(c).importLatest() }),
  cronImport: async (c: Context<AppEnv>) => c.json({ data: await new ExchangeRateService(c.get('db'), { id: null, userType: 'SYSTEM' }).importLatest() }),
}
