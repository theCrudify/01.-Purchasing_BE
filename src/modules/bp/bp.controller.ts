import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { BpService } from './bp.service'

type C = Context<AppEnv>
const svc = (c: C) => new BpService(c.get('db'), c.get('actor'))

export const bpController = {
  list: async (c: C, qs: any) => c.json(await svc(c).list(qs)),
  get: async (c: C, id: string) => c.json({ data: await svc(c).get(id) }),
  create: async (c: C, body: any) => c.json({ data: await svc(c).create(body) }, 201),
  update: async (c: C, id: string, body: any) => c.json({ data: await svc(c).update(id, body) }),
  listSvr: async (c: C, qs: any) => c.json(await svc(c).listSvr(qs)),
  createSvr: async (c: C, body: any) => c.json({ data: await svc(c).createSvr(body) }, 201),
  submitSvr: async (c: C, id: string) => c.json({ data: await svc(c).submitSvr(id) }),
}
