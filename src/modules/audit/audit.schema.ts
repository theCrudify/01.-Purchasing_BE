import { z } from 'zod'
import { listQuerySchema, type ListConfig } from '../../core/list-query'
import { isoDate } from '../_master/shared'

/** Read-only trails. Each list reads a view from 0200_identity.sql; filters are exact-match + date range. */
export const AUDIT_LISTS = {
  logs: {
    cfg: { table: 'v_audit_log', select: { id: 'Id', tableName: 'TableName', recordKey: 'RecordKey', action: 'Action', changes: 'Changes', actorId: 'ActorPublicId', actorEmail: 'ActorEmail', occurredAt: 'OccurredAt' },
      searchable: ['TableName', 'RecordKey'], sortable: { occurredAt: 'OccurredAt', tableName: 'TableName' }, defaultSort: 'occurredAt:desc', tiebreaker: 'Id' },
    filters: { tableName: 'TableName', recordKey: 'RecordKey', action: 'Action', actorId: 'ActorPublicId' },
  },
  activity: {
    cfg: { table: 'v_user_activity', select: { id: 'Id', userId: 'UserPublicId', email: 'Email', action: 'Action', ipAddress: 'IpAddress', userAgent: 'UserAgent', detail: 'Detail', occurredAt: 'OccurredAt' },
      searchable: ['Email', 'Action'], sortable: { occurredAt: 'OccurredAt', action: 'Action' }, defaultSort: 'occurredAt:desc', tiebreaker: 'Id' },
    filters: { userId: 'UserPublicId', action: 'Action' },
  },
  access: {
    cfg: { table: 'v_access_log', select: { id: 'Id', userId: 'UserPublicId', email: 'Email', action: 'Action', objectType: 'ObjectType', objectKey: 'ObjectKey', detail: 'Detail', ipAddress: 'IpAddress', occurredAt: 'OccurredAt' },
      searchable: ['ObjectType', 'Email'], sortable: { occurredAt: 'OccurredAt', action: 'Action' }, defaultSort: 'occurredAt:desc', tiebreaker: 'Id' },
    filters: { userId: 'UserPublicId', action: 'Action', objectType: 'ObjectType' },
  },
  sessions: {
    cfg: { table: 'v_user_session_list', select: { id: 'Id', userId: 'UserPublicId', email: 'Email', displayName: 'DisplayName', authMethod: 'AuthMethod', ipAddress: 'IpAddress', userAgent: 'UserAgent', startedAt: 'StartedAt', lastSeenAt: 'LastSeenAt', endedAt: 'EndedAt', endReason: 'EndReason', endedByEmail: 'EndedByEmail', isActive: 'IsActive' },
      searchable: ['Email', 'DisplayName', 'IpAddress'], sortable: { startedAt: 'StartedAt', lastSeenAt: 'LastSeenAt', email: 'Email' }, defaultSort: 'startedAt:desc', tiebreaker: 'Id' },
    filters: { userId: 'UserPublicId', isActive: 'IsActive' },
  },
} satisfies Record<string, { cfg: ListConfig; filters: Record<string, string>; }>

export type AuditKind = keyof typeof AUDIT_LISTS
export const auditKind = z.object({ kind: z.enum(['logs', 'activity', 'access', 'sessions']) })
export const auditListQuery = listQuerySchema.extend({
  from: isoDate.optional(), to: isoDate.optional(),
  tableName: z.string().max(64).optional(), recordKey: z.string().max(100).optional(), action: z.string().max(30).optional(),
  actorId: z.string().uuid().optional(), userId: z.string().uuid().optional(), objectType: z.string().max(40).optional(), isActive: z.enum(['true', 'false']).optional(),
})
export type AuditListQuery = z.infer<typeof auditListQuery>
