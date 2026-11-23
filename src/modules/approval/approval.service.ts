import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import type { ListQuery } from '../../core/list-query'
import { CrudRepository, CrudService } from '../../core/crud'
import { HttpError, conflict, forbidden, notFound } from '../../core/errors'
import { rule } from '../_master/shared'
import { decideTask, type Decision } from './approval.engine'
import { ApprovalConfigRepository } from './approval-config.repository'
import { templateDef, type ConfigListQuery, type StepsBody, type TaskListQuery } from './approval.schema'

/** Inbox + decisions. Decisions run in one transaction with the document status change and the module's hook. */
export class ApprovalService {
  constructor(private db: Db, private actor: Actor, private afterDecision?: () => void) {}
  private run<T>(fn: (r: ApprovalConfigRepository) => Promise<T>) { return this.db.session(this.actor, (q) => fn(new ApprovalConfigRepository(q))) }

  inbox(qs: TaskListQuery) { return this.run((r) => r.inbox(this.actor.id, qs)) }
  decided(qs: TaskListQuery) { return this.run((r) => r.decided(this.actor.id, qs)) }
  inboxCount() { return this.run(async (r) => ({ pending: await r.inboxCount(this.actor.id) })) }

  async decide(taskId: string, decision: Decision, remarks?: string) {
    const out = await this.db.session(this.actor, (q) => decideTask(q, this.actor, taskId, decision, remarks))
    this.afterDecision?.() // e-mail the next approvers / requester now instead of waiting for the daily cron
    return out
  }
}

// ---------------------------------------------------------------------------- configuration

const STEP_NEEDS: Record<string, (s: StepsBody['steps'][number]) => string | null> = {
  USER: (s) => (s.approverUserId ? null : 'approverUserId is required'),
  ROLE: (s) => (s.approverRoleId ? null : 'approverRoleId is required'),
  REQUESTER_PICK: (s) => (s.stepCode ? null : 'stepCode is required'),
  PREPARER_MAPPING: (s) => (s.stepCode ? null : 'stepCode is required'),
  PREPARER_MAPPING_PICK: (s) => (s.stepCode ? null : 'stepCode is required'),
  BP_PIC: (s) => (s.picRole ? null : 'picRole is required'),
  SUPERIOR: () => null,
  DEPARTMENT_HEAD: () => null,
}

export class TemplateService extends CrudService<CrudRepository> {
  constructor(db: Db, actor: Actor) {
    const check = async (_r: CrudRepository, d: Record<string, unknown>) => {
      if (d.minAmountBase != null && d.maxAmountBase != null && Number(d.minAmountBase) >= Number(d.maxAmountBase)) throw rule('Min amount must be below max amount')
      if (d.effectiveTo && d.effectiveFrom && String(d.effectiveTo) < String(d.effectiveFrom)) throw rule('Effective to is before effective from')
    }
    super(db, actor, (q) => new CrudRepository(q, templateDef), templateDef, { beforeCreate: check, beforeUpdate: (r, _k, d) => check(r, d) })
  }

  steps(id: number) { return this.db.session(this.actor, async (q) => { this.found(await new CrudRepository(q, templateDef).get(id)); return new ApprovalConfigRepository(q).steps(id) }) }

  replaceSteps(id: number, body: StepsBody) {
    for (const [i, s] of body.steps.entries()) { const e = STEP_NEEDS[s.approverType]!(s); if (e) throw rule(`Step ${i + 1}: ${e}`) }
    return this.db.session(this.actor, async (q) => {
      const r = new ApprovalConfigRepository(q)
      this.found(await new CrudRepository(q, templateDef).get(id))
      if (await r.hasOpenRounds(id)) throw conflict('The template is used by approvals in progress; create a new template version instead')
      const steps = []
      for (const s of body.steps) {
        const approverUserNumId = s.approverUserId ? ((await r.userId(s.approverUserId)) ?? null) : null
        if (s.approverUserId && !approverUserNumId) throw rule('Approver user must be an internal user')
        steps.push({ ...s, approverUserNumId })
      }
      await r.replaceSteps(id, steps)
      return r.steps(id)
    })
  }
}

/** Mappings, backups and delegations. Users manage their own backups / delegations; APPROVAL.CONFIG manages everyone's. */
export class ApprovalSetupService {
  constructor(private db: Db, private actor: Actor) {}
  private get admin() { return this.actor.permissions.has('APPROVAL.CONFIG') }
  private run<T>(fn: (r: ApprovalConfigRepository) => Promise<T>) { return this.db.session(this.actor, (q) => fn(new ApprovalConfigRepository(q))) }
  private async uid(r: ApprovalConfigRepository, publicId: string, what: string) {
    const id = await r.userId(publicId)
    if (!id) throw rule(`${what} must be an internal user`)
    return id
  }

  mappings(qs: ConfigListQuery) { return this.run((r) => r.mappings(qs)) }
  addMapping(d: { preparerId: string; approverId: string; docType: string; stepCode: string }) {
    return this.run(async (r) => {
      const p = await this.uid(r, d.preparerId, 'Preparer'), a = await this.uid(r, d.approverId, 'Approver')
      if (p === a) throw rule('A preparer cannot approve their own documents')
      return { id: await r.addMapping(p, a, d.docType, d.stepCode, this.actor.id) }
    })
  }
  removeMapping(id: number) { return this.run(async (r) => { if (!(await r.removeMapping(id, this.actor.id))) throw notFound('Approver mapping') }) }

  backups(qs: ConfigListQuery) { return this.run((r) => r.backups(qs, this.admin && !qs.mine ? undefined : this.actor.id)) }
  addBackup(d: { approverId: string; backupId: string; notes?: string | null }) {
    return this.run(async (r) => {
      const a = await this.uid(r, d.approverId, 'Approver'), b = await this.uid(r, d.backupId, 'Backup')
      if (a !== this.actor.id && !this.admin) throw forbidden('You can only set backups for yourself')
      if (a === b) throw rule('A user cannot be their own backup')
      return { id: await r.addBackup(a, b, d.notes ?? null, this.actor.id) }
    })
  }
  removeBackup(id: number) {
    return this.run(async (r) => {
      const owner = await r.backupOwner(id)
      if (!owner) throw notFound('Backup')
      if (owner !== this.actor.id && !this.admin) throw forbidden()
      await r.removeBackup(id, this.actor.id)
    })
  }

  delegations(qs: ConfigListQuery) { return this.run((r) => r.delegations(qs, this.admin && !qs.mine ? undefined : this.actor.id)) }
  addDelegation(d: { fromId?: string; toId: string; docType?: string | null; startsAt: string; endsAt: string; reason?: string }) {
    return this.run(async (r) => {
      const from = d.fromId ? await this.uid(r, d.fromId, 'Delegator') : this.actor.id
      if (from !== this.actor.id && !this.admin) throw forbidden('You can only delegate your own approvals')
      const to = await this.uid(r, d.toId, 'Delegate')
      if (from === to) throw rule('Cannot delegate to yourself')
      if (new Date(d.endsAt) <= new Date()) throw rule('The delegation period is already over')
      if (await r.overlappingDelegation(from, d.docType ?? null, d.startsAt, d.endsAt)) throw new HttpError(409, 'CONFLICT', 'An active delegation already covers this period')
      return { id: await r.addDelegation(from, to, d.docType ?? null, d.startsAt, d.endsAt, d.reason ?? null, this.actor.id) }
    })
  }
  revokeDelegation(id: number) {
    return this.run(async (r) => {
      const from = await r.delegationFrom(id)
      if (!from) throw notFound('Delegation')
      if (from !== this.actor.id && !this.admin) throw forbidden()
      await r.revokeDelegation(id)
    })
  }
}

export type { ListQuery }
