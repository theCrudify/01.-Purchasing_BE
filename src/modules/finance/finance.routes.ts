import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth, requireUserType } from '../../middleware/auth'
import { financeController as ctl } from './finance.controller'
import { ariCreate, caCreate, finIdParam, finListQuery, invCreate, payCreate, rmbCreate, stlCreate } from './finance.schema'

const idP = validate('param', finIdParam)
const listQ = validate('query', finListQuery)

export const coaLookupRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', (c) => ctl.listCoas(c))

export const txTypeLookupRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', listQ, (c) => ctl.listTransactionTypes(c, c.req.valid('query').module))

export const companyBankLookupRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', (c) => ctl.listCompanyBanks(c))

export const expenseCategoryLookupRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', (c) => ctl.listExpenseCategories(c))

export const caRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'))
  .get('/', listQ, (c) => ctl.listCa(c, c.req.valid('query')))
  .get('/:id/lines', idP, (c) => ctl.caLines(c, c.req.valid('param').id))
  .post('/', validate('json', caCreate), (c) => ctl.createCa(c, c.req.valid('json')))
  .patch('/:id', idP, validate('json', caCreate), (c) => ctl.updateCa(c, c.req.valid('param').id, c.req.valid('json')))
  .post('/:id/submit', idP, (c) => ctl.submit(c, c.req.valid('param').id))

export const stlRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'))
  .get('/', listQ, (c) => ctl.listStl(c, c.req.valid('query')))
  .get('/:id/lines', idP, (c) => ctl.stlLines(c, c.req.valid('param').id))
  .post('/', validate('json', stlCreate), (c) => ctl.createStl(c, c.req.valid('json')))
  .patch('/:id', idP, validate('json', stlCreate), (c) => ctl.updateStl(c, c.req.valid('param').id, c.req.valid('json')))
  .post('/:id/submit', idP, (c) => ctl.submit(c, c.req.valid('param').id))

export const rmbRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'))
  .get('/', listQ, (c) => ctl.listRmb(c, c.req.valid('query')))
  .get('/:id/lines', idP, (c) => ctl.rmbLines(c, c.req.valid('param').id))
  .post('/', validate('json', rmbCreate), (c) => ctl.createRmb(c, c.req.valid('json')))
  .patch('/:id', idP, validate('json', rmbCreate), (c) => ctl.updateRmb(c, c.req.valid('param').id, c.req.valid('json')))
  .post('/:id/submit', idP, (c) => ctl.submit(c, c.req.valid('param').id))

export const invRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', listQ, (c) => ctl.listInv(c, c.req.valid('query')))
  .get('/:id/lines', idP, (c) => ctl.invLines(c, c.req.valid('param').id))
  .post('/', validate('json', invCreate), (c) => ctl.createInv(c, c.req.valid('json')))
  .patch('/:id', idP, validate('json', invCreate), (c) => ctl.updateInv(c, c.req.valid('param').id, c.req.valid('json')))
  .post('/:id/submit', idP, (c) => ctl.submit(c, c.req.valid('param').id))

export const payRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', listQ, (c) => ctl.listPay(c, c.req.valid('query')))
  .post('/', requireUserType('INTERNAL'), validate('json', payCreate), (c) => ctl.createPay(c, c.req.valid('json')))
  .patch('/:id', requireUserType('INTERNAL'), idP, validate('json', payCreate), (c) => ctl.updatePay(c, c.req.valid('param').id, c.req.valid('json')))
  .post('/:id/submit', requireUserType('INTERNAL'), idP, (c) => ctl.submit(c, c.req.valid('param').id))

export const ariRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', listQ, (c) => ctl.listAri(c, c.req.valid('query')))
  .get('/:id/lines', idP, (c) => ctl.ariLines(c, c.req.valid('param').id))
  .post('/', requireUserType('INTERNAL'), validate('json', ariCreate), (c) => ctl.createAri(c, c.req.valid('json')))
  .patch('/:id', requireUserType('INTERNAL'), idP, validate('json', ariCreate), (c) => ctl.updateAri(c, c.req.valid('param').id, c.req.valid('json')))
  .post('/:id/submit', requireUserType('INTERNAL'), idP, (c) => ctl.submit(c, c.req.valid('param').id))
