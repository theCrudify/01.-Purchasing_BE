import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../../env'
import { crudRoutes } from '../../core/crud'
import { validate } from '../../core/validate'
import { requireAuth, requirePermission, requireUserType } from '../../middleware/auth'
import { approvalController as ctl, setupController as setup, templateController as tpl } from './approval.controller'
import { backupCreate, configListQuery, decideBody, delegationCreate, idParam, mappingCreate, stepsBody, taskListQuery, taskParam, templateCreate, templateDef } from './approval.schema'

const CONFIG = requirePermission('APPROVAL.CONFIG')
const keyParam = z.object({ key: z.coerce.number().int().positive() })

/** /api/approvals — inbox, decisions, own backups / delegations. */
export const approvalRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireUserType('INTERNAL'))
  .get('/tasks', validate('query', taskListQuery), (c) => ctl.inbox(c, c.req.valid('query')))
  .get('/tasks/count', (c) => ctl.count(c))
  .get('/decided', validate('query', taskListQuery), (c) => ctl.decided(c, c.req.valid('query')))
  .post('/tasks/:taskId/decide', validate('param', taskParam), validate('json', decideBody), (c) => ctl.decide(c, c.req.valid('param').taskId, c.req.valid('json')))
  .get('/backups', validate('query', configListQuery), (c) => setup.backups(c, c.req.valid('query')))
  .post('/backups', validate('json', backupCreate), (c) => setup.addBackup(c, c.req.valid('json')))
  .delete('/backups/:id', validate('param', idParam), (c) => setup.removeBackup(c, c.req.valid('param').id))
  .get('/delegations', validate('query', configListQuery), (c) => setup.delegations(c, c.req.valid('query')))
  .post('/delegations', validate('json', delegationCreate), (c) => setup.addDelegation(c, c.req.valid('json')))
  .post('/delegations/:id/revoke', validate('param', idParam), (c) => setup.revokeDelegation(c, c.req.valid('param').id))
  .get('/mappings', CONFIG, validate('query', configListQuery), (c) => setup.mappings(c, c.req.valid('query')))
  .post('/mappings', CONFIG, validate('json', mappingCreate), (c) => setup.addMapping(c, c.req.valid('json')))
  .delete('/mappings/:id', CONFIG, validate('param', idParam), (c) => setup.removeMapping(c, c.req.valid('param').id))

/** /api/approval-templates — CRUD + steps (APPROVAL.CONFIG). */
export const templateRoutes = crudRoutes(templateDef, tpl, { create: templateCreate }, { view: 'APPROVAL.CONFIG', manage: 'APPROVAL.CONFIG', delete: 'APPROVAL.CONFIG' })
  .get('/:key/steps', CONFIG, validate('param', keyParam), (c) => tpl.steps(c, c.req.valid('param').key))
  .put('/:key/steps', CONFIG, validate('param', keyParam), validate('json', stepsBody), (c) => tpl.replaceSteps(c, c.req.valid('param').key, c.req.valid('json')))
