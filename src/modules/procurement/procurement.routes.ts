import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth, requireUserType } from '../../middleware/auth'
import { procurementController as ctl } from './procurement.controller'
import { ctrCreate, docIdParam, docListQuery, grCreate, poCreate, prCreate, quoCreate, rfqCreate } from './procurement.schema'

const idP = validate('param', docIdParam)
const listQ = validate('query', docListQuery)

export const prRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'))
  .get('/', listQ, (c) => ctl.listPr(c, c.req.valid('query')))
  .get('/:id/lines', idP, (c) => ctl.prLines(c, c.req.valid('param').id))
  .post('/', validate('json', prCreate), (c) => ctl.createPr(c, c.req.valid('json')))
  .patch('/:id', idP, validate('json', prCreate), (c) => ctl.updatePr(c, c.req.valid('param').id, c.req.valid('json')))
  .post('/:id/submit', idP, (c) => ctl.submit(c, c.req.valid('param').id))

export const rfqRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'))
  .get('/', listQ, (c) => ctl.listRfq(c, c.req.valid('query')))
  .get('/:id/lines', idP, (c) => ctl.rfqLines(c, c.req.valid('param').id))
  .post('/', validate('json', rfqCreate), (c) => ctl.createRfq(c, c.req.valid('json')))
  .patch('/:id', idP, validate('json', rfqCreate), (c) => ctl.updateRfq(c, c.req.valid('param').id, c.req.valid('json')))
  .post('/:id/submit', idP, (c) => ctl.submit(c, c.req.valid('param').id))

export const quoRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', listQ, (c) => ctl.listQuo(c, c.req.valid('query')))
  .post('/', validate('json', quoCreate), (c) => ctl.createQuo(c, c.req.valid('json')))
  .patch('/:id', idP, validate('json', quoCreate), (c) => ctl.updateQuo(c, c.req.valid('param').id, c.req.valid('json')))
  .post('/:id/submit', idP, (c) => ctl.submit(c, c.req.valid('param').id))

export const ctrRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', listQ, (c) => ctl.listCtr(c, c.req.valid('query')))
  .post('/', validate('json', ctrCreate), (c) => ctl.createCtr(c, c.req.valid('json')))
  .patch('/:id', idP, validate('json', ctrCreate), (c) => ctl.updateCtr(c, c.req.valid('param').id, c.req.valid('json')))
  .post('/:id/submit', idP, (c) => ctl.submit(c, c.req.valid('param').id))

export const poRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', listQ, (c) => ctl.listPo(c, c.req.valid('query')))
  .get('/:id/lines', idP, (c) => ctl.poLines(c, c.req.valid('param').id))
  .post('/', requireUserType('INTERNAL'), validate('json', poCreate), (c) => ctl.createPo(c, c.req.valid('json')))
  .patch('/:id', requireUserType('INTERNAL'), idP, validate('json', poCreate), (c) => ctl.updatePo(c, c.req.valid('param').id, c.req.valid('json')))
  .post('/:id/submit', requireUserType('INTERNAL'), idP, (c) => ctl.submit(c, c.req.valid('param').id))

export const grRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/', listQ, (c) => ctl.listGr(c, c.req.valid('query')))
  .post('/', requireUserType('INTERNAL'), validate('json', grCreate), (c) => ctl.createGr(c, c.req.valid('json')))
  .patch('/:id', requireUserType('INTERNAL'), idP, validate('json', grCreate), (c) => ctl.updateGr(c, c.req.valid('param').id, c.req.valid('json')))
  .post('/:id/submit', requireUserType('INTERNAL'), idP, (c) => ctl.submit(c, c.req.valid('param').id))
