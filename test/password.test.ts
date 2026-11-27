import { describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import { ITER, hashPassword, needsRehash, verifyPassword } from '../src/core/password'

describe('password', () => {
  it('pbkdf2 round trip, wrong password, legacy bcrypt, rehash flag, garbage', async () => {
    const h = await hashPassword('Secret-pass-123')
    expect(h.startsWith(`pbkdf2$${ITER}$`)).toBe(true)
    expect(await verifyPassword('Secret-pass-123', h)).toBe(true)
    expect(await verifyPassword('wrong', h)).toBe(false)
    expect(needsRehash(h)).toBe(false)
    const legacy = await bcrypt.hash('Secret-pass-123', 4)
    expect(await verifyPassword('Secret-pass-123', legacy)).toBe(true)
    expect(needsRehash(legacy)).toBe(true)
    expect(await verifyPassword('x', 'pbkdf2$999999999$aa$bb')).toBe(false)
    expect(await verifyPassword('x', 'garbage')).toBe(false)
  })
})
