import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { ApprovalConfigRepository } from '../approval/approval-config.repository'
import { PORTAL_DOC_TYPES } from '../document/document.schema'
import { NotificationRepository } from '../notification/notification.repository'
import { DashboardRepository } from './dashboard.repository'

export class DashboardService {
  constructor(private db: Db, private actor: Actor) {}
  internal() {
    return this.db.session(this.actor, async (q) => {
      const r = new DashboardRepository(q)
      return {
        pendingApprovals: await new ApprovalConfigRepository(q).inboxCount(this.actor.id),
        unreadNotifications: await new NotificationRepository(q).unread(this.actor.id),
        myDocuments: await r.myDocuments(this.actor.id),
        monthly: await r.myMonthly(this.actor.id),
        recentNotifications: await r.recentNotifications(this.actor.id),
      }
    })
  }
  portal() {
    return this.db.session(this.actor, async (q) => {
      const r = new DashboardRepository(q)
      return {
        unreadNotifications: await new NotificationRepository(q).unread(this.actor.id),
        documents: await r.bpDocuments(this.actor.id, [...PORTAL_DOC_TYPES]),
        recentNotifications: await r.recentNotifications(this.actor.id),
      }
    })
  }
}
