// Usage: DATABASE_URL=... ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='...' npm run seed:admin
import pg from 'pg'
import bcrypt from 'bcryptjs'

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 4) throw new Error('Set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD (>= 4 chars)')

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const c = await pool.connect()
try {
  await c.query('BEGIN')
  const role = (await c.query(`INSERT INTO mst_role ("Code","Name","Scope") VALUES ('ADMIN','Administrator','INTERNAL') ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`)).rows[0].Id
  await c.query(`INSERT INTO mst_role_permission ("RoleId","PermissionId") SELECT $1,"Id" FROM mst_permission ON CONFLICT DO NOTHING`, [role])
  const u = (await c.query(`INSERT INTO mst_user ("UserType","Email","DisplayName","Status") VALUES ('INTERNAL',$1,'Administrator','ACTIVE') ON CONFLICT ("Email") DO UPDATE SET "Status"='ACTIVE' RETURNING "Id"`, [ADMIN_EMAIL.toLowerCase()])).rows[0].Id
  await c.query(`INSERT INTO sys_user_credential ("UserId","PasswordHash","PasswordChangedAt") VALUES ($1,$2,now()) ON CONFLICT ("UserId") DO UPDATE SET "PasswordHash"=EXCLUDED."PasswordHash","FailedLoginCount"=0,"LockoutCount"=0,"LockoutUntil"=NULL`, [u, await bcrypt.hash(ADMIN_PASSWORD, 4)])
  await c.query(`INSERT INTO mst_user_role ("UserId","RoleId") VALUES ($1,$2) ON CONFLICT DO NOTHING`, [u, role])
  await c.query('COMMIT'); console.log('admin ready:', ADMIN_EMAIL)
} catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release(); await pool.end() }
