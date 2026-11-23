import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { ReassignmentService } from './reassignment.service'
import type { ReassignmentCreate, ReassignmentListQuery } from './reassignment.schema'

const svc = (c: Context<AppEnv>) => new ReassignmentService(c.get('db'), c.get('actor'))
export const reassignmentController = {
  list: async (c: Context<AppEnv>, qs: ReassignmentListQuery) => c.json(await svc(c).list(qs)),
  create: async (c: Context<AppEnv>, d: ReassignmentCreate) => c.json({ data: await svc(c).create(d) }, 201),
  decide: async (c: Context<AppEnv>, id: string, d: { decision: 'APPROVE' | 'REJECT'; remarks?: string }) => c.json({ data: await svc(c).decide(id, d.decision, d.remarks) }),
}
