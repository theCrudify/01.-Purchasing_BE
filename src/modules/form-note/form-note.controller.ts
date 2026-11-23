import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { crudController } from '../../core/crud'
import { FormNoteService } from './form-note.service'

const svc = (c: Context<AppEnv>) => new FormNoteService(c.get('db'), c.get('actor'))

/** HTTP in/out only: validated input → service → JSON. */
export const formNoteController = {
  ...crudController(svc),
  // shaped like a list response so the web LookupSelect can use it
  userLookup: async (c: Context<AppEnv>, q?: string) => { const data = await svc(c).userLookup(q); return c.json({ data, meta: { page: 1, pageSize: 20, total: data.length, totalPages: 1 } }) },
  user: async (c: Context<AppEnv>, publicId: string) => c.json({ data: await svc(c).user(publicId) }),
}
