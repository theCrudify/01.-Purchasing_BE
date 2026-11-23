import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { HttpError } from '../../core/errors'
import { fileResponse } from '../../core/storage'
import { DocumentService } from './document.service'
import { attachmentForm } from './document.schema'

type C = Context<AppEnv>
const svc = (c: C) => new DocumentService(c.get('db'), c.get('actor'))

export const documentController = {
  get: async (c: C, id: string) => c.json({ data: await svc(c).get(id) }),
  attachments: async (c: C, id: string) => c.json({ data: await svc(c).attachments(id) }),
  addAttachment: async (c: C, id: string) => {
    const parsed = attachmentForm.safeParse(await c.req.parseBody())
    if (!parsed.success) throw new HttpError(422, 'VALIDATION', 'Invalid upload', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })))
    return c.json({ data: await svc(c).addAttachment(id, parsed.data) }, 201)
  },
  download: async (c: C, id: string, attId: string) => fileResponse(await svc(c).download(id, attId)),
  removeAttachment: async (c: C, id: string, attId: string) => { await svc(c).removeAttachment(id, attId); return c.json({ ok: true }) },
  comments: async (c: C, id: string) => c.json({ data: await svc(c).comments(id) }),
  addComment: async (c: C, id: string, b: { body: string; visibility?: 'SHARED' | 'INTERNAL' }) => c.json({ data: await svc(c).addComment(id, b.body, b.visibility) }, 201),
  cancel: async (c: C, id: string, reason: string) => { await svc(c).cancel(id, reason); return c.json({ ok: true }) },
  withdraw: async (c: C, id: string, reason: string) => { await svc(c).withdraw(id, reason); return c.json({ ok: true }) },
  remove: async (c: C, id: string, reason: string) => { await svc(c).remove(id, reason); return c.json({ ok: true }) },
  restore: async (c: C, id: string) => { await svc(c).restore(id); return c.json({ ok: true }) },
  deleted: async (c: C, qs: any) => c.json(await svc(c).deleted(qs)),
}
