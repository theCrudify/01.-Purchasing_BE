import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { NotificationService } from './notification.service'
import type { NotificationListQuery } from './notification.schema'

const svc = (c: Context<AppEnv>) => new NotificationService(c.get('db'), c.get('actor'))
export const notificationController = {
  list: async (c: Context<AppEnv>, qs: NotificationListQuery) => c.json(await svc(c).list(qs)),
  unread: async (c: Context<AppEnv>) => c.json({ data: await svc(c).unread() }),
  read: async (c: Context<AppEnv>, id: string) => { await svc(c).markRead(id); return c.json({ ok: true }) },
  readAll: async (c: Context<AppEnv>) => { await svc(c).markRead(); return c.json({ ok: true }) },
}
