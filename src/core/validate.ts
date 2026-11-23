import { zValidator } from '@hono/zod-validator'
import type { ZodTypeAny } from 'zod'
import { HttpError } from './errors'

type Target = 'json' | 'query' | 'param' | 'form' | 'header'

/** zod validation for every route; failures become the uniform 422 VALIDATION error. */
export const validate = <T extends Target, S extends ZodTypeAny>(target: T, schema: S) =>
  zValidator(target, schema, (r) => {
    if (!r.success) throw new HttpError(422, 'VALIDATION', 'Invalid input', r.error.issues.map((i: any) => ({ path: i.path.join('.'), message: i.message })))
  })
