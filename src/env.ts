import type { Db } from './core/db'
import type { Actor } from './core/types'

/** Runtime config. Workers pass it as bindings, Node/Vercel as process.env — `readConfig` merges both. */
export type Config = {
  DATABASE_URL: string
  JWT_SECRET: string
  ALLOWED_ORIGINS: string
  COOKIE_SECURE?: string
  CRON_SECRET?: string
  RESEND_API_KEY?: string
  MAIL_FROM?: string
  APP_URL?: string
  PAYMENT_API_KEY?: string // MUFG / bank callback key
  ENTRA_TENANT_ID?: string // Microsoft Entra ID SSO: enabled only when all three are set
  ENTRA_CLIENT_ID?: string
  ENTRA_CLIENT_SECRET?: string
}
export type Bindings = Partial<Config>
export type Vars = { db: Db; actor: Actor; requestId: string; cfg: Config }
export type AppEnv = { Bindings: Bindings; Variables: Vars }

const KEYS: (keyof Config)[] = ['DATABASE_URL', 'JWT_SECRET', 'ALLOWED_ORIGINS', 'COOKIE_SECURE', 'CRON_SECRET', 'RESEND_API_KEY', 'MAIL_FROM', 'APP_URL', 'PAYMENT_API_KEY', 'ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET']

export function readConfig(bindings: Bindings | undefined): Config {
  const pe = (globalThis as any).process?.env ?? {}
  const cfg = Object.fromEntries(KEYS.map((k) => [k, bindings?.[k] ?? pe[k]])) as Config
  if (!cfg.DATABASE_URL || !cfg.JWT_SECRET || cfg.JWT_SECRET.length < 32) throw new Error('DATABASE_URL and JWT_SECRET (>= 32 chars) are required')
  cfg.ALLOWED_ORIGINS ??= cfg.APP_URL ?? 'http://localhost:3000'
  return cfg
}
