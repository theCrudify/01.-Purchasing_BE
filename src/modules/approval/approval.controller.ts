import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { crudController } from '../../core/crud'
import { deferOf } from '../../core/defer'
import { dispatchQueued } from '../notification/notification.service'
import { ApprovalService, ApprovalSetupService, TemplateService } from './approval.service'
import type { Decision } from './approval.engine'

type C = Context<AppEnv>
const svc = (c: C) => new ApprovalService(c.get('db'), c.get('actor'), () => deferOf(c)(dispatchQueued(c.get('db'), c.get('cfg'), 20)))
const setup = (c: C) => new ApprovalSetupService(c.get('db'), c.get('actor'))
const tpl = (c: C) => new TemplateService(c.get('db'), c.get('actor'))

export const approvalController = {
  inbox: async (c: C, qs: any) => c.json(await svc(c).inbox(qs)),
  decided: async (c: C, qs: any) => c.json(await svc(c).decided(qs)),
  count: async (c: C) => c.json({ data: await svc(c).inboxCount() }),
  decide: async (c: C, taskId: string, d: { decision: Decision; remarks?: string }) => c.json({ data: await svc(c).decide(taskId, d.decision, d.remarks) }),
}
export const templateController = {
  ...crudController(tpl),
  steps: async (c: C, id: number) => c.json({ data: await tpl(c).steps(id) }),
  replaceSteps: async (c: C, id: number, body: any) => c.json({ data: await tpl(c).replaceSteps(id, body) }),
}
export const setupController = {
  mappings: async (c: C, qs: any) => c.json(await setup(c).mappings(qs)),
  addMapping: async (c: C, d: any) => c.json({ data: await setup(c).addMapping(d) }, 201),
  removeMapping: async (c: C, id: number) => { await setup(c).removeMapping(id); return c.json({ ok: true }) },
  backups: async (c: C, qs: any) => c.json(await setup(c).backups(qs)),
  addBackup: async (c: C, d: any) => c.json({ data: await setup(c).addBackup(d) }, 201),
  removeBackup: async (c: C, id: number) => { await setup(c).removeBackup(id); return c.json({ ok: true }) },
  delegations: async (c: C, qs: any) => c.json(await setup(c).delegations(qs)),
  addDelegation: async (c: C, d: any) => c.json({ data: await setup(c).addDelegation(d) }, 201),
  revokeDelegation: async (c: C, id: number) => { await setup(c).revokeDelegation(id); return c.json({ ok: true }) },
}
