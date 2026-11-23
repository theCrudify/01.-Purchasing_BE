import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { rule } from '../_master/shared'
import { FormNoteRepository } from './form-note.repository'
import { formNoteDef } from './form-note.schema'

/** The API speaks user PublicId; the table stores the numeric UserId. */
async function resolveUser(repo: FormNoteRepository, d: Record<string, unknown>) {
  if (d.userId == null) return
  const u = await repo.user(d.userId as string)
  if (!u) throw rule('User must be an internal user')
  d.userId = u.internalId
}

export class FormNoteService extends CrudService<FormNoteRepository> {
  constructor(db: Db, actor: Actor) {
    super(db, actor, (q) => new FormNoteRepository(q), formNoteDef, { beforeCreate: resolveUser, beforeUpdate: (r, _k, d) => resolveUser(r, d) })
  }
  userLookup(q?: string) { return this.run((r) => r.userLookup(q)) }
  user(publicId: string) {
    return this.run(async (r) => { const { internalId: _, ...u } = this.found(await r.user(publicId), 'User'); return u })
  }
}
