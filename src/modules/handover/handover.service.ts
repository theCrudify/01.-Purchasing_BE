import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import type { ListQuery } from '../../core/list-query'
import { notFound } from '../../core/errors'
import { rule } from '../_master/shared'
import { requestReassignment } from '../reassignment/reassignment.service'
import { HandoverRepository } from './handover.repository'
import type { HandoverCreate } from './handover.schema'

/**
 * Employee handover (resign / transfer / long leave), one transaction (README "Handover"):
 * open documents, approver mappings & template steps, BP PIC roles, department head and subordinates move to the successor;
 * open approval tasks are NOT moved directly — a reassignment request goes to the chosen superior.
 */
export class HandoverService {
  constructor(private db: Db, private actor: Actor) {}
  list(qs: ListQuery) { return this.db.session(this.actor, (q) => new HandoverRepository(q).list(qs)) }
  get(id: number) { return this.db.session(this.actor, async (q) => (await new HandoverRepository(q).get(id)) ?? Promise.reject(notFound('Handover'))) }

  execute(d: HandoverCreate) {
    return this.db.session(this.actor, async (q) => {
      const r = new HandoverRepository(q)
      const from = await r.user(d.fromId), to = await r.user(d.toId)
      if (!from || !to) throw rule('Both users must be internal users')
      if (from.id === to.id) throw rule('The successor must be a different user')
      if (to.status !== 'ACTIVE') throw rule('The successor must be an active user')
      const h = await r.create({ from: from.id, to: to.id, reason: d.reason, effectiveDate: d.effectiveDate, remarks: d.remarks, executedBy: this.actor.id })
      await q.query(`SELECT set_config('purchasing.handover_id', $1, true)`, [String(h)])
      const counts = {
        documents: await r.documents(h, from.id, to.id),
        mappings: await r.mappings(h, from.id, to.id),
        picRoles: await r.picRoles(h, from.id, to.id),
        orgRoles: await r.orgRoles(h, from.id, to.id),
      }
      if (d.reason !== 'LEAVE') await r.endEmployment(from.id, d.reason, d.effectiveDate)
      let reassignment: { id: string; tasks: number } | null = null
      if (await r.openTaskCount(from.id)) {
        if (!d.approverId) throw rule('The user still has open approval tasks: choose the superior who approves moving them')
        const approver = await r.user(d.approverId)
        if (!approver) throw rule('Approver must be an internal user')
        const reason = d.reason === 'LEAVE' ? 'LEAVE' : d.reason === 'TRANSFERRED' ? 'TRANSFERRED' : 'RESIGNED'
        reassignment = await requestReassignment(q, this.actor, { from: from.id, to: to.id, approver: approver.id, reason, remarks: d.remarks?.trim() || `Handover ${d.reason}`, handoverId: h })
      }
      await r.complete(h, counts)
      await q.query(`SELECT set_config('purchasing.handover_id', '', true)`)
      return { id: h, ...counts, reassignment }
    })
  }
}
