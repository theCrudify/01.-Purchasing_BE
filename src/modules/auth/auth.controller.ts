import { clientIp } from '../../core/client-ip'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { AppEnv } from '../../env'
import { ACCESS_COOKIE } from '../../middleware/auth'
import { HttpError, unauthorized } from '../../core/errors'
import { AuthService } from './auth.service'
import { ACCESS_TTL_S, REFRESH_TTL_S } from './auth.tokens'
import type { LoginInput } from './auth.schema'
import { entraEnabled, finishFlow, startFlow } from './auth.entra'

const REFRESH_COOKIE = 'purchasing_rt'
const FLOW_COOKIE = 'purchasing_oidc'
const safeNext = (n: string | undefined) => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : '/dashboard')
const client = (c: Context<AppEnv>) => [clientIp(c), c.req.header('user-agent') ?? null] as const
const svc = (c: Context<AppEnv>) => new AuthService(c.get('db'), c.get('cfg').JWT_SECRET)

function setTokens(c: Context<AppEnv>, t: { access: string; refresh: string }) {
  const base = { httpOnly: true, secure: c.get('cfg').COOKIE_SECURE !== 'false', sameSite: 'Lax' as const }
  setCookie(c, ACCESS_COOKIE, t.access, { ...base, path: '/', maxAge: ACCESS_TTL_S })
  setCookie(c, REFRESH_COOKIE, t.refresh, { ...base, path: '/api/auth', maxAge: REFRESH_TTL_S })
}

export const authController = {
  async login(c: Context<AppEnv>, input: LoginInput) {
    const t = await svc(c).login(input, clientIp(c), c.req.header('user-agent') ?? null)
    setTokens(c, t)
    return c.json({ ok: true })
  },
  async refresh(c: Context<AppEnv>) {
    const rt = getCookie(c, REFRESH_COOKIE)
    if (!rt) throw unauthorized()
    setTokens(c, await svc(c).refresh(rt))
    return c.json({ ok: true })
  },
  async logout(c: Context<AppEnv>) {
    await svc(c).logout(c.get('actor'))
    deleteCookie(c, ACCESS_COOKIE, { path: '/' })
    deleteCookie(c, REFRESH_COOKIE, { path: '/api/auth' })
    return c.json({ ok: true })
  },
  providers(c: Context<AppEnv>) {
    return c.json({ data: { password: true, microsoft: entraEnabled(c.get('cfg')) } })
  },
  async entraStart(c: Context<AppEnv>, next?: string) {
    const cfg = c.get('cfg')
    if (!entraEnabled(cfg)) throw new HttpError(404, 'NOT_FOUND', 'SSO is not enabled')
    const { url, flow } = await startFlow(cfg, safeNext(next))
    setCookie(c, FLOW_COOKIE, flow, { httpOnly: true, secure: cfg.COOKIE_SECURE !== 'false', sameSite: 'Lax', path: '/api/auth/entra', maxAge: 600 })
    return c.redirect(url, 302)
  },
  /** Browser lands here from Microsoft: always answer with a redirect (errors → /login?error=sso). */
  async entraCallback(c: Context<AppEnv>, q: { code?: string; state?: string; error?: string }) {
    const cfg = c.get('cfg')
    const flow = getCookie(c, FLOW_COOKIE)
    deleteCookie(c, FLOW_COOKIE, { path: '/api/auth/entra' })
    try {
      if (!entraEnabled(cfg) || q.error || !q.code || !q.state) throw unauthorized('SSO cancelled')
      const id = await finishFlow(cfg, flow, q.code, q.state)
      setTokens(c, await svc(c).ssoLogin(id.oid, id.email, ...client(c)))
      return c.redirect(safeNext(id.next), 302)
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(JSON.stringify({ requestId: c.get('requestId'), msg: 'sso', err: (e as Error).message }))
      return c.redirect('/login?error=sso', 302)
    }
  },
  me(c: Context<AppEnv>) {
    const a = c.get('actor')
    return c.json({ data: { id: a.publicId, email: a.email, displayName: a.displayName, userType: a.userType, permissions: [...a.permissions] } })
  },
}
