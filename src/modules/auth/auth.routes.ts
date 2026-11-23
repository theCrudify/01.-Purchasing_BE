import { Hono } from 'hono'
import { validate } from '../../core/validate'
import type { AppEnv } from '../../env'
import { requireAuth } from '../../middleware/auth'
import { rateLimit } from '../../middleware/rate-limit'
import { authController } from './auth.controller'
import { entraCallbackSchema, entraStartSchema, loginSchema } from './auth.schema'

export const authRoutes = new Hono<AppEnv>()
  .post('/login', rateLimit('login', 10, 60_000), validate('json', loginSchema), (c) => authController.login(c, c.req.valid('json')))
  .post('/refresh', rateLimit('refresh', 30, 60_000), (c) => authController.refresh(c))
  .post('/logout', requireAuth, (c) => authController.logout(c))
  .get('/me', requireAuth, (c) => authController.me(c))
  .get('/providers', (c) => authController.providers(c))
  .get('/entra/start', rateLimit('sso', 20, 60_000), validate('query', entraStartSchema), (c) => authController.entraStart(c, c.req.valid('query').next))
  .get('/entra/callback', rateLimit('sso', 20, 60_000), validate('query', entraCallbackSchema), (c) => authController.entraCallback(c, c.req.valid('query')))
