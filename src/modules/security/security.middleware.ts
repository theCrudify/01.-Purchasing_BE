import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { HttpError } from '../../core/errors'
import { IpAllowListRepository } from './security.repository'
import { parseIp } from './security.schema'

// shortcut: trusts the platform's client-IP header (Cloudflare cf-connecting-ip, Vercel x-real-ip); behind any other proxy these are spoofable — set the trusted header per deployment.
export const clientIp = (c: Context<AppEnv>) => parseIp(c.req.header('cf-connecting-ip') ?? c.req.header('x-real-ip'))

/**
 * Optional IP allow list (sys_ip_allow_list, as the old Expressiv IpAllowListMiddleware): OFF while the table has
 * no active row; once any row is active, only covered IPs pass (fail closed, no cache — changes apply immediately).
 */
export const ipAllowList = createMiddleware<AppEnv>(async (c, next) => {
  const ip = clientIp(c)
  const { ok } = await c.get('db').session({ id: null, userType: 'SYSTEM' }, (q) => new IpAllowListRepository(q).allows(ip))
  if (!ok) throw new HttpError(403, 'IP_NOT_ALLOWED', 'Your IP address is not allowed to use this function')
  await next()
})
