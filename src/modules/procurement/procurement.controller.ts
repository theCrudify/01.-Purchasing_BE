import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { ProcurementService } from './procurement.service'

type C = Context<AppEnv>
const svc = (c: C) => new ProcurementService(c.get('db'), c.get('actor'))

export const procurementController = {
  listPr: async (c: C, qs: any) => c.json(await svc(c).listPr(qs)),
  prLines: async (c: C, id: string) => c.json({ data: await svc(c).prLines(id) }),
  createPr: async (c: C, body: any) => c.json({ data: await svc(c).createPr(body) }, 201),
  updatePr: async (c: C, id: string, body: any) => c.json({ data: await svc(c).updatePr(id, body) }),

  listRfq: async (c: C, qs: any) => c.json(await svc(c).listRfq(qs)),
  rfqLines: async (c: C, id: string) => c.json({ data: await svc(c).rfqLines(id) }),
  createRfq: async (c: C, body: any) => c.json({ data: await svc(c).createRfq(body) }, 201),
  updateRfq: async (c: C, id: string, body: any) => c.json({ data: await svc(c).updateRfq(id, body) }),

  listQuo: async (c: C, qs: any) => c.json(await svc(c).listQuo(qs)),
  createQuo: async (c: C, body: any) => c.json({ data: await svc(c).createQuo(body) }, 201),
  updateQuo: async (c: C, id: string, body: any) => c.json({ data: await svc(c).updateQuo(id, body) }),

  listCtr: async (c: C, qs: any) => c.json(await svc(c).listCtr(qs)),
  createCtr: async (c: C, body: any) => c.json({ data: await svc(c).createCtr(body) }, 201),
  updateCtr: async (c: C, id: string, body: any) => c.json({ data: await svc(c).updateCtr(id, body) }),

  listPo: async (c: C, qs: any) => c.json(await svc(c).listPo(qs)),
  poLines: async (c: C, id: string) => c.json({ data: await svc(c).poLines(id) }),
  createPo: async (c: C, body: any) => c.json({ data: await svc(c).createPo(body) }, 201),
  updatePo: async (c: C, id: string, body: any) => c.json({ data: await svc(c).updatePo(id, body) }),

  listGr: async (c: C, qs: any) => c.json(await svc(c).listGr(qs)),
  createGr: async (c: C, body: any) => c.json({ data: await svc(c).createGr(body) }, 201),
  updateGr: async (c: C, id: string, body: any) => c.json({ data: await svc(c).updateGr(id, body) }),

  submit: async (c: C, id: string) => c.json({ data: await svc(c).submit(id) }),
}
