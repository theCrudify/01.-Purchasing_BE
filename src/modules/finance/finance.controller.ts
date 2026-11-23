import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { FinanceService } from './finance.service'

type C = Context<AppEnv>
const svc = (c: C) => new FinanceService(c.get('db'), c.get('actor'))

export const financeController = {
  listCoas: async (c: C) => c.json(await svc(c).listCoas()),
  listTransactionTypes: async (c: C, module?: string) => c.json(await svc(c).listTransactionTypes(module)),
  listCompanyBanks: async (c: C) => c.json(await svc(c).listCompanyBanks()),
  listExpenseCategories: async (c: C) => c.json(await svc(c).listExpenseCategories()),

  listCa: async (c: C, qs: any) => c.json(await svc(c).listCa(qs)),
  caLines: async (c: C, id: string) => c.json({ data: await svc(c).expenseLines(id) }),
  createCa: async (c: C, body: any) => c.json({ data: await svc(c).createCa(body) }, 201),
  updateCa: async (c: C, id: string, body: any) => c.json({ data: await svc(c).updateCa(id, body) }),

  listStl: async (c: C, qs: any) => c.json(await svc(c).listStl(qs)),
  stlLines: async (c: C, id: string) => c.json({ data: await svc(c).expenseLines(id) }),
  createStl: async (c: C, body: any) => c.json({ data: await svc(c).createStl(body) }, 201),
  updateStl: async (c: C, id: string, body: any) => c.json({ data: await svc(c).updateStl(id, body) }),

  listRmb: async (c: C, qs: any) => c.json(await svc(c).listRmb(qs)),
  rmbLines: async (c: C, id: string) => c.json({ data: await svc(c).expenseLines(id) }),
  createRmb: async (c: C, body: any) => c.json({ data: await svc(c).createRmb(body) }, 201),
  updateRmb: async (c: C, id: string, body: any) => c.json({ data: await svc(c).updateRmb(id, body) }),

  listInv: async (c: C, qs: any) => c.json(await svc(c).listInv(qs)),
  invLines: async (c: C, id: string) => c.json({ data: await svc(c).invLines(id) }),
  createInv: async (c: C, body: any) => c.json({ data: await svc(c).createInv(body) }, 201),
  updateInv: async (c: C, id: string, body: any) => c.json({ data: await svc(c).updateInv(id, body) }),

  listPay: async (c: C, qs: any) => c.json(await svc(c).listPay(qs)),
  createPay: async (c: C, body: any) => c.json({ data: await svc(c).createPay(body) }, 201),
  updatePay: async (c: C, id: string, body: any) => c.json({ data: await svc(c).updatePay(id, body) }),

  listAri: async (c: C, qs: any) => c.json(await svc(c).listAri(qs)),
  ariLines: async (c: C, id: string) => c.json({ data: await svc(c).ariLines(id) }),
  createAri: async (c: C, body: any) => c.json({ data: await svc(c).createAri(body) }, 201),
  updateAri: async (c: C, id: string, body: any) => c.json({ data: await svc(c).updateAri(id, body) }),

  submit: async (c: C, id: string) => c.json({ data: await svc(c).submit(id) }),
}
