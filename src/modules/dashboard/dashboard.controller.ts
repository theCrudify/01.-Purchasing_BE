import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { DashboardService } from './dashboard.service'

const svc = (c: Context<AppEnv>) => new DashboardService(c.get('db'), c.get('actor'))
export const dashboardController = {
  internal: async (c: Context<AppEnv>) => c.json({ data: await svc(c).internal() }),
  portal: async (c: Context<AppEnv>) => c.json({ data: await svc(c).portal() }),
}
