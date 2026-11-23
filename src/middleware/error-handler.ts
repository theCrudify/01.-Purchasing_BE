import type { ErrorHandler } from 'hono'
import { ZodError } from 'zod'
import { HttpError } from '../core/errors'
import type { AppEnv } from '../env'

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId')
  if (err instanceof HttpError) return c.json({ error: { code: err.code, message: err.message, details: err.details, requestId } }, err.status)
  if (err instanceof ZodError) return c.json({ error: { code: 'VALIDATION', message: 'Invalid input', details: err.flatten(), requestId } }, 422)
  if ((err as any).badSort) return c.json({ error: { code: 'VALIDATION', message: err.message, requestId } }, 422)
  // Postgres: unique violation / FK violation / check violation raised by the DB rules
  const pg = (err as any).code as string | undefined
  if (pg === '23505') return c.json({ error: { code: 'CONFLICT', message: 'Duplicate value', requestId } }, 409)
  if (pg === '23503' || pg === '23514' || pg === 'P0001') return c.json({ error: { code: 'RULE_VIOLATION', message: (err as any).message?.slice(0, 200) ?? 'Rule violation', requestId } }, 422)
  console.error(JSON.stringify({ requestId, msg: err.message, stack: err.stack })) // never leak internals to the client
  return c.json({ error: { code: 'INTERNAL', message: 'Internal server error', requestId } }, 500)
}
