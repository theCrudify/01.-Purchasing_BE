import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { validate } from '../../core/validate'
import { requireAuth, requireUserType } from '../../middleware/auth'
import { rateLimit } from '../../middleware/rate-limit'
import { documentController as ctl } from './document.controller'
import { attParam, commentBody, deletedQuery, docParam, reasonBody } from './document.schema'

const doc = validate('param', docParam)

/** /api/documents/:publicId/… — shared by every document type, for internal and portal users (visibility in document.core). */
export const documentRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get('/deleted', requireUserType('INTERNAL'), validate('query', deletedQuery), (c) => ctl.deleted(c, c.req.valid('query')))
  .get('/:publicId', doc, (c) => ctl.get(c, c.req.valid('param').publicId))
  .get('/:publicId/attachments', doc, (c) => ctl.attachments(c, c.req.valid('param').publicId))
  .post('/:publicId/attachments', rateLimit('upload', 30, 60_000), doc, (c) => ctl.addAttachment(c, c.req.valid('param').publicId))
  .get('/:publicId/attachments/:attId', validate('param', attParam), (c) => ctl.download(c, c.req.valid('param').publicId, c.req.valid('param').attId))
  .delete('/:publicId/attachments/:attId', validate('param', attParam), (c) => ctl.removeAttachment(c, c.req.valid('param').publicId, c.req.valid('param').attId))
  .get('/:publicId/comments', doc, (c) => ctl.comments(c, c.req.valid('param').publicId))
  .post('/:publicId/comments', doc, validate('json', commentBody), (c) => ctl.addComment(c, c.req.valid('param').publicId, c.req.valid('json')))
  .post('/:publicId/cancel', requireUserType('INTERNAL'), doc, validate('json', reasonBody), (c) => ctl.cancel(c, c.req.valid('param').publicId, c.req.valid('json').reason))
  .post('/:publicId/withdraw', requireUserType('INTERNAL'), doc, validate('json', reasonBody), (c) => ctl.withdraw(c, c.req.valid('param').publicId, c.req.valid('json').reason))
  .post('/:publicId/delete', doc, validate('json', reasonBody), (c) => ctl.remove(c, c.req.valid('param').publicId, c.req.valid('json').reason))
  .post('/:publicId/restore', requireUserType('INTERNAL'), doc, (c) => ctl.restore(c, c.req.valid('param').publicId))
