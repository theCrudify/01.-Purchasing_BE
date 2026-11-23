import type { Db, SessionActor } from '../../core/db'
import type { Config } from '../../env'
import { mailLayout, sendMail } from '../../core/mailer'
import { docTypeHooks } from '../document/document.registry'
import { NotificationRepository } from './notification.repository'
import type { NotificationListQuery } from './notification.schema'

export class NotificationService {
  constructor(private db: Db, private actor: SessionActor & { id: number | null }) {}
  private run<T>(fn: (r: NotificationRepository) => Promise<T>) { return this.db.session(this.actor, (q) => fn(new NotificationRepository(q))) }
  list(qs: NotificationListQuery) { return this.run((r) => r.list(this.actor.id!, qs)) }
  unread() { return this.run(async (r) => ({ unread: await r.unread(this.actor.id!) })) }
  markRead(id?: string) { return this.run((r) => r.markRead(this.actor.id!, id)) }
}

/**
 * Send queued notification e-mails (cron + right after approval actions). Each claimed row is marked SENT / FAILED;
 * a crash mid-batch leaves rows in SENDING, which the cleanup cron re-queues.
 */
export async function dispatchQueued(db: Db, cfg: Config, limit = 50) {
  const SYSTEM = { id: null, userType: 'SYSTEM' } as const
  const batch = await db.session(SYSTEM, (q) => new NotificationRepository(q).claimQueued(limit))
  const base = (cfg.APP_URL ?? cfg.ALLOWED_ORIGINS.split(',')[0]!).replace(/\/$/, '')
  let sent = 0, failed = 0
  for (const n of batch) {
    const path = n.docType && n.docPublicId ? (docTypeHooks(n.docType).path?.(n.docPublicId) ?? '/approvals') : '/notifications'
    const r = await sendMail(cfg, { to: n.email, subject: n.title, html: mailLayout(n.title, [`Hello ${n.name},`, ...(n.body ? [n.body] : [])], { href: `${base}${path}`, label: 'Open in KPIN' }) })
      .catch((e) => ({ ok: false, error: (e as Error).message }))
    await db.session(SYSTEM, (q) => new NotificationRepository(q).markSent(n.id, r.ok ? null : (r.error ?? 'send failed')))
    r.ok ? sent++ : failed++
  }
  return { claimed: batch.length, sent, failed }
}
