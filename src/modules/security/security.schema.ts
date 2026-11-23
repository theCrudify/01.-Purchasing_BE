import { z } from 'zod'
import type { CrudDef } from '../../core/crud'

export const ipAllowListDef: CrudDef = {
  name: 'IP allow list entry',
  table: 'sys_ip_allow_list',
  key: { col: 'Id', type: 'int' },
  fields: { id: 'Id', ipOrCidr: 'IpOrCidr', description: 'Description', isActive: 'IsActive', createdAt: 'CreatedAt', createdBy: 'CreatedBy' },
  searchable: ['IpOrCidr', 'Description'],
  sortable: { ipOrCidr: 'IpOrCidr', description: 'Description', isActive: 'IsActive', createdAt: 'CreatedAt' },
  defaultSort: 'ipOrCidr:asc',
  softDelete: false,
  audit: false, // only CreatedBy, set by the repository
  hasUpdatedAt: false,
}

const ipOrCidr = z.string().trim().max(50).refine(
  (s) => [z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()].some((v) => v.safeParse(s).success), 'IPv4 / IPv6 address or CIDR, e.g. 10.0.0.0/8')
export const ipCreate = z.object({ ipOrCidr, description: z.string().trim().max(200).nullable().optional(), isActive: z.boolean().optional() })
export const sessionParam = z.object({ id: z.string().uuid() })

/** A syntactically valid client IP or null (never cast garbage to inet). */
export const parseIp = (s: string | null | undefined) => (s && (z.ipv4().safeParse(s).success || z.ipv6().safeParse(s).success) ? s : null)
