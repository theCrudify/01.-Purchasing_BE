import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { HandoverService } from './handover.service'
import type { HandoverCreate } from './handover.schema'

const svc = (c: Context<AppEnv>) => new HandoverService(c.get('db'), c.get('actor'))
export const handoverController = {
  list: async (c: Context<AppEnv>, qs: any) => c.json(await svc(c).list(qs)),
  get: async (c: Context<AppEnv>, id: number) => c.json({ data: await svc(c).get(id) }),
  execute: async (c: Context<AppEnv>, d: HandoverCreate) => c.json({ data: await svc(c).execute(d) }, 201),
}
