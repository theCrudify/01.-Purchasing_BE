import type { Db } from '../../core/db'
import { notFound } from '../../core/errors'
import type { ListQuery } from '../../core/list-query'
import type { Actor } from '../../core/types'
import { submitForApproval } from '../approval/approval.engine'
import { assignNumber, createDraft, loadDocument } from '../document/document.core'
import { BpRepository } from './bp.repository'
import type { BpCreate, BpUpdate, SvrCreate } from './bp.schema'

export class BpService {
  constructor(private db: Db, private actor: Actor) {}

  list(qs: ListQuery & { operationalStatus?: string; onboardingStatus?: string }) {
    return this.db.session(this.actor, (q) => new BpRepository(q).list(qs))
  }

  get(publicId: string) {
    return this.db.session(this.actor, async (q) => {
      const bp = await new BpRepository(q).byPublicId(publicId)
      if (!bp) throw notFound('Business partner')
      const { id: _id, publicId: id, ...rest } = bp
      return { id, ...rest }
    })
  }

  create(d: BpCreate) {
    return this.db.session(this.actor, async (q) => {
      const bp = await new BpRepository(q).create(d, this.actor.id)
      const { id: _id, publicId: id, ...rest } = bp!
      return { id, ...rest }
    })
  }

  update(publicId: string, d: BpUpdate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new BpRepository(q)
      const curr = await repo.byPublicId(publicId)
      if (!curr) throw notFound('Business partner')
      const bp = await repo.update(curr.id, publicId, d, this.actor.id)
      const { id: _id, publicId: id, ...rest } = bp!
      return { id, ...rest }
    })
  }

  listSvr(qs: ListQuery & { status?: string }) {
    return this.db.session(this.actor, (q) => new BpRepository(q).listSvr(qs))
  }

  createSvr(d: SvrCreate) {
    return this.db.session(this.actor, async (q) => {
      const repo = new BpRepository(q)
      const bp = await repo.byPublicId(d.bpId)
      if (!bp) throw notFound('Business partner')
      const doc = await createDraft(q, this.actor, 'SVR', {
        title: d.title,
        bpId: bp.id,
        remarks: d.remarks ?? null,
      })
      await repo.insertSvr(doc.id, d.requestType)
      await assignNumber(q, this.actor, doc.id)
      return repo.getSvr(doc.id)
    })
  }

  submitSvr(publicId: string) {
    return this.db.session(this.actor, async (q) => {
      const d = await loadDocument(q, this.actor, publicId, { lock: true })
      return submitForApproval(q, this.actor, d.id)
    })
  }
}
