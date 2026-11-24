import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from './env'
import { requestContext } from './middleware/request-context'
import { originGuard } from './middleware/origin-guard'
import { rateLimit } from './middleware/rate-limit'
import { errorHandler } from './middleware/error-handler'
import { authRoutes } from './modules/auth/auth.routes'
import * as identity from './modules/_registry/identity'
import * as master from './modules/_registry/master'
import * as workflow from './modules/_registry/workflow'
import * as bp from './modules/_registry/bp'
import * as procurement from './modules/_registry/procurement'

export const app = new Hono<AppEnv>()
  .use(requestContext)
  .use(secureHeaders())
  .use((c, next) => cors({ origin: c.get('cfg').ALLOWED_ORIGINS.split(',').map((s) => s.trim()), credentials: true, maxAge: 600 })(c, next))
  .use(bodyLimit({ maxSize: 6 * 1024 * 1024 })) // attachments <= 5MB
  .use(rateLimit('global', 300, 60_000))
  .use(originGuard)
  .get('/api/health', (c) => c.json({ ok: true }))
  .route('/api/auth', authRoutes)

// Each group registers its own routers in src/modules/_registry/<group>.ts
for (const g of [identity, master, workflow, bp, procurement]) {
  for (const [path, router] of g.routes) app.route(`/api${path}`, router)
}

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))
app.onError(errorHandler)

// Workers: fetch serves HTTP; scheduled (wrangler.toml [triggers]) replays the daily cron route with the secret.
export default {
  fetch: app.fetch,
  scheduled: (_e: ScheduledController, env: AppEnv['Bindings'], ctx: ExecutionContext) =>
    ctx.waitUntil(Promise.resolve(app.fetch(new Request('https://cron.internal/api/cron/daily', { headers: { 'x-cron-secret': env.CRON_SECRET ?? '' } }), env, ctx))),
}
