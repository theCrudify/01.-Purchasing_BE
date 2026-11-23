import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { clientIp } from '../../core/client-ip'
import { HttpError } from '../../core/errors'
import { fileResponse } from '../../core/storage'
import { ProfileService } from './profile.service'
import type { PasswordChange, ProfileUpdate } from './profile.schema'

const svc = (c: Context<AppEnv>) => new ProfileService(c.get('db'), c.get('actor'))
export const profileController = {
  get: async (c: Context<AppEnv>) => c.json({ data: await svc(c).get() }),
  update: async (c: Context<AppEnv>, d: ProfileUpdate) => c.json({ data: await svc(c).update(d) }),
  changePassword: async (c: Context<AppEnv>, d: PasswordChange) => { await svc(c).changePassword(d, clientIp(c)); return c.json({ ok: true }) },
  uploadSignature: async (c: Context<AppEnv>) => {
    const body = await c.req.parseBody()
    if (!(body.file instanceof File)) throw new HttpError(422, 'FILE_REQUIRED', 'Field "file" is required')
    return c.json({ data: await svc(c).uploadSignature(body.file) })
  },
  signature: async (c: Context<AppEnv>) => fileResponse(await svc(c).signature(), true),
}
