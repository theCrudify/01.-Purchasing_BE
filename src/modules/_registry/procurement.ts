import type { Hono } from 'hono'
import type { AppEnv } from '../../env'

/** Routes owned by the "procurement" group: [mount path under /api, router]. Only this group edits this file. */
export const routes: [string, Hono<AppEnv, any, any>][] = []
