import { SignJWT, base64url, createRemoteJWKSet, jwtVerify } from 'jose'
import type { Config } from '../../env'
import { unauthorized } from '../../core/errors'

/** Microsoft Entra ID (OIDC authorization code + PKCE). Enabled only when tenant, client id and secret are configured. */
export const entraEnabled = (cfg: Config) => !!(cfg.ENTRA_TENANT_ID && cfg.ENTRA_CLIENT_ID && cfg.ENTRA_CLIENT_SECRET)

const authority = (cfg: Config) => `https://login.microsoftonline.com/${encodeURIComponent(cfg.ENTRA_TENANT_ID!)}`
export const redirectUri = (cfg: Config) => `${(cfg.APP_URL ?? cfg.ALLOWED_ORIGINS.split(',')[0]!).trim().replace(/\/$/, '')}/api/auth/entra/callback`
const key = (s: string) => new TextEncoder().encode(s)
const rand = () => base64url.encode(crypto.getRandomValues(new Uint8Array(32)))
const FLOW_AUD = 'kpin:entra-flow'

const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>()
const tenantKeys = (cfg: Config) => {
  let k = jwks.get(cfg.ENTRA_TENANT_ID!)
  if (!k) { k = createRemoteJWKSet(new URL(`${authority(cfg)}/discovery/v2.0/keys`)); jwks.set(cfg.ENTRA_TENANT_ID!, k) }
  return k
}

/** Authorize URL + a signed short-lived flow token (state, nonce, PKCE verifier, next) kept in an httpOnly cookie. */
export async function startFlow(cfg: Config, next: string) {
  const state = rand(), nonce = rand(), verifier = rand()
  const challenge = base64url.encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  const flow = await new SignJWT({ st: state, n: nonce, v: verifier, nx: next }).setProtectedHeader({ alg: 'HS256' })
    .setAudience(FLOW_AUD).setIssuedAt().setExpirationTime('10m').sign(key(cfg.JWT_SECRET))
  const u = new URL(`${authority(cfg)}/oauth2/v2.0/authorize`)
  u.search = new URLSearchParams({
    client_id: cfg.ENTRA_CLIENT_ID!, response_type: 'code', redirect_uri: redirectUri(cfg), response_mode: 'query',
    scope: 'openid profile email', state, nonce, code_challenge: challenge, code_challenge_method: 'S256',
  }).toString()
  return { url: u.toString(), flow }
}

/** Validate state, redeem the code (with the PKCE verifier) and verify the id_token against the tenant JWKS. */
export async function finishFlow(cfg: Config, flowToken: string | undefined, code: string, state: string) {
  if (!flowToken) throw unauthorized('SSO flow expired')
  const { payload: f } = await jwtVerify(flowToken, key(cfg.JWT_SECRET), { algorithms: ['HS256'], audience: FLOW_AUD }).catch(() => { throw unauthorized('SSO flow expired') })
  if (f.st !== state) throw unauthorized('SSO state mismatch')
  const r = await fetch(`${authority(cfg)}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(cfg), client_id: cfg.ENTRA_CLIENT_ID!, client_secret: cfg.ENTRA_CLIENT_SECRET!, code_verifier: String(f.v) }),
  })
  const tok = (await r.json().catch(() => ({}))) as { id_token?: string }
  if (!r.ok || !tok.id_token) throw unauthorized('SSO code exchange failed')
  const { payload: id } = await jwtVerify(tok.id_token, tenantKeys(cfg), {
    issuer: `https://login.microsoftonline.com/${cfg.ENTRA_TENANT_ID}/v2.0`, audience: cfg.ENTRA_CLIENT_ID!, algorithms: ['RS256'],
  }).catch(() => { throw unauthorized('Invalid id_token') })
  if (id.nonce !== f.n) throw unauthorized('SSO nonce mismatch')
  const oid = typeof id.oid === 'string' ? id.oid : null
  const email = String(id.email ?? id.preferred_username ?? '').trim().toLowerCase()
  if (!oid || !email) throw unauthorized('id_token lacks oid / email')
  return { oid, email, next: String(f.nx ?? '') }
}
