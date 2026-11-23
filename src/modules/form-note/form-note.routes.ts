import { z } from 'zod'
import { crudRoutes } from '../../core/crud'
import { validate } from '../../core/validate'
import { requirePermission } from '../../middleware/auth'
import { formNoteController as ctl } from './form-note.controller'
import { formNoteCreate, formNoteDef, userLookupQuery } from './form-note.schema'

/** Wiring only. /lookup/users/* are 2-3 segments, so they never collide with /:key. */
export const formNoteRoutes = crudRoutes(formNoteDef, ctl, { create: formNoteCreate })
  .get('/lookup/users', requirePermission('MASTER.MANAGE'), validate('query', userLookupQuery), (c) => ctl.userLookup(c, c.req.valid('query').q))
  .get('/lookup/users/:id', requirePermission('MASTER.MANAGE'), validate('param', z.object({ id: z.string().uuid() })), (c) => ctl.user(c, c.req.valid('param').id))
