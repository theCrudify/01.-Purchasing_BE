import type { Context } from 'hono'

/** Client IP behind Cloudflare / Vercel / the FE proxy (first hop of x-forwarded-for). */
export const clientIp = (c: Context) =>
  c.req.header('cf-connecting-ip') ?? c.req.header('x-real-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null
