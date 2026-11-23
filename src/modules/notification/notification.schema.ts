import { z } from 'zod'
import { listQuerySchema, type ListConfig } from '../../core/list-query'

export const notificationList: ListConfig = {
  table: 'vw_notification',
  select: { id: 'PublicId', eventType: 'EventType', title: 'Title', body: 'Body', readAt: 'ReadAt', createdAt: 'CreatedAt', documentId: 'DocumentPublicId', docType: 'DocType', docNo: 'DocNo' },
  searchable: ['Title'],
  sortable: { createdAt: 'CreatedAt' },
  defaultSort: 'createdAt:desc',
  tiebreaker: 'Id',
}
export const notificationListQuery = listQuerySchema.extend({ unread: z.enum(['true']).optional() })
export const notificationParam = z.object({ id: z.string().uuid() })
export type NotificationListQuery = z.infer<typeof notificationListQuery>
