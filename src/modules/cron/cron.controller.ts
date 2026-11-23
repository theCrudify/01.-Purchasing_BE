import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { CronService } from './cron.service'

const svc = (c: Context<AppEnv>) => new CronService(c.get('db'), c.get('cfg'))
export const cronController = {
  daily: async (c: Context<AppEnv>) => c.json({ data: await svc(c).daily() }),
  dispatch: async (c: Context<AppEnv>) => c.json({ data: await svc(c).dispatch() }),
  cleanup: async (c: Context<AppEnv>) => c.json({ data: await svc(c).cleanup() }),
}
