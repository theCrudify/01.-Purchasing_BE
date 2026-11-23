import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { deferOf } from '../password-reset/password-reset.controller'
import { UserService } from './user.service'

const svc = (c: Context<AppEnv>) => new UserService(c.get('db'), c.get('actor'), c.get('cfg'), deferOf(c))
type C = Context<AppEnv>

/** HTTP in/out only. */
export const userController = {
  list: async (c: C, qs: any) => c.json(await svc(c).list(qs)),
  lookup: async (c: C, qs: any) => c.json(await svc(c).lookup(qs)),
  lookupOne: async (c: C, id: string) => c.json({ data: await svc(c).lookupOne(id) }),
  get: async (c: C, id: string) => c.json({ data: await svc(c).get(id) }),
  create: async (c: C, body: any) => c.json({ data: await svc(c).create(body) }, 201),
  update: async (c: C, id: string, body: any) => c.json({ data: await svc(c).update(id, body) }),
  setRoles: async (c: C, id: string, roleIds: number[]) => c.json({ data: await svc(c).setRoles(id, roleIds) }),
  disable: async (c: C, id: string, reason?: string) => c.json({ data: await svc(c).disable(id, reason) }),
  enable: async (c: C, id: string) => c.json({ data: await svc(c).enable(id) }),
  unlock: async (c: C, id: string) => c.json({ data: await svc(c).unlock(id) }),
  forceLogout: async (c: C, id: string) => c.json({ data: await svc(c).forceLogout(id) }),
  sessions: async (c: C, id: string, qs: any) => c.json(await svc(c).sessions(id, qs)),
  sendReset: async (c: C, id: string) => c.json({ data: await svc(c).sendReset(id) }),
}
