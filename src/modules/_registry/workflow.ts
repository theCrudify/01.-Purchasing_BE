import type { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { documentRoutes } from '../document/document.routes'
import { approvalRoutes, templateRoutes } from '../approval/approval.routes'
import { notificationRoutes } from '../notification/notification.routes'
import { dashboardRoutes } from '../dashboard/dashboard.routes'
import { cronRoutes } from '../cron/cron.routes'
import { reassignmentRoutes } from '../reassignment/reassignment.routes'
import { handoverRoutes } from '../handover/handover.routes'

/** Routes owned by the "workflow" group. */
export const routes: [string, Hono<AppEnv, any, any>][] = [
  ['/documents', documentRoutes],
  ['/approvals', approvalRoutes],
  ['/approval-templates', templateRoutes],
  ['/notifications', notificationRoutes],
  ['/dashboard', dashboardRoutes],
  ['/cron', cronRoutes],
  ['/reassignments', reassignmentRoutes],
  ['/handovers', handoverRoutes],
]
