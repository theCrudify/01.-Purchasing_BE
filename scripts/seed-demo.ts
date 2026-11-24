// Usage: DATABASE_URL=... npm run seed:demo
// Seeds standard demo accounts for internal staff (admin, buyer, approver, finance)
// and business partner portal (vendor, supplier). Default password: Password123!
import pg from 'pg'
import bcrypt from 'bcryptjs'

const { DATABASE_URL } = process.env
if (!DATABASE_URL) throw new Error('Set DATABASE_URL in .env')

const DEMO_PW = process.env.DEMO_PASSWORD || 'Password123!'

const INTERNAL_USERS = [
  {
    roleCode: 'ADMIN',
    roleName: 'Administrator',
    email: 'admin@purchasing.local',
    name: 'Administrator',
  },
  {
    roleCode: 'BUYER',
    roleName: 'Purchasing Buyer',
    email: 'buyer@purchasing.local',
    name: 'Budi Buyer',
  },
  {
    roleCode: 'APPROVER',
    roleName: 'Department Approver',
    email: 'approver@purchasing.local',
    name: 'Siti Approver',
  },
  {
    roleCode: 'FINANCE',
    roleName: 'Finance Staff',
    email: 'finance@purchasing.local',
    name: 'Fajar Finance',
  },
]

const VENDORS = [
  {
    bpCode: 'VEND-001',
    legalName: 'PT Sumber Makmur Sentosa',
    tradeName: 'Sumber Makmur',
    entityType: 'PT',
    taxId: '01.234.567.8-012.000',
    email: 'vendor@supplier.com',
    contactName: 'PT Sumber Makmur Sentosa',
  },
  {
    bpCode: 'VEND-002',
    legalName: 'CV Mitra Jaya Perkasa',
    tradeName: 'Mitra Jaya',
    entityType: 'CV',
    taxId: '02.345.678.9-023.000',
    email: 'mitra@supplier.com',
    contactName: 'CV Mitra Jaya Perkasa',
  },
]

async function run() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL })
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const passwordHash = await bcrypt.hash(DEMO_PW, 12)

    console.log('--- Seeding Internal Demo Accounts ---')
    for (const u of INTERNAL_USERS) {
      // 1. Role
      const roleRes = await c.query(
        `INSERT INTO mst_role ("Code","Name","Scope") VALUES ($1,$2,'INTERNAL')
         ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`,
        [u.roleCode, u.roleName]
      )
      const roleId = roleRes.rows[0].Id

      // Assign all permissions to internal roles for demo ease
      await c.query(
        `INSERT INTO mst_role_permission ("RoleId","PermissionId")
         SELECT $1,"Id" FROM mst_permission ON CONFLICT DO NOTHING`,
        [roleId]
      )

      // 2. User
      const userRes = await c.query(
        `INSERT INTO mst_user ("UserType","Email","DisplayName","Status")
         VALUES ('INTERNAL',$1,$2,'ACTIVE')
         ON CONFLICT ("Email") DO UPDATE SET "Status"='ACTIVE',"DisplayName"=EXCLUDED."DisplayName"
         RETURNING "Id"`,
        [u.email.toLowerCase(), u.name]
      )
      const userId = userRes.rows[0].Id

      // 3. Credential
      await c.query(
        `INSERT INTO sys_user_credential ("UserId","PasswordHash","PasswordChangedAt")
         VALUES ($1,$2,now())
         ON CONFLICT ("UserId") DO UPDATE SET "PasswordHash"=EXCLUDED."PasswordHash",
         "FailedLoginCount"=0,"LockoutCount"=0,"LockoutUntil"=NULL`,
        [userId, passwordHash]
      )

      // 4. User Role
      await c.query(
        `INSERT INTO mst_user_role ("UserId","RoleId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [userId, roleId]
      )

      console.log(`✓ Internal ready: ${u.email} (${u.roleCode})`)
    }

    console.log('--- Seeding Vendor Demo Accounts ---')
    for (const v of VENDORS) {
      // 1. BP User
      const userRes = await c.query(
        `INSERT INTO mst_user ("UserType","Email","DisplayName","Status")
         VALUES ('BP',$1,$2,'ACTIVE')
         ON CONFLICT ("Email") DO UPDATE SET "Status"='ACTIVE',"DisplayName"=EXCLUDED."DisplayName"
         RETURNING "Id"`,
        [v.email.toLowerCase(), v.contactName]
      )
      const userId = userRes.rows[0].Id

      // 2. BP User Credential
      await c.query(
        `INSERT INTO sys_user_credential ("UserId","PasswordHash","PasswordChangedAt")
         VALUES ($1,$2,now())
         ON CONFLICT ("UserId") DO UPDATE SET "PasswordHash"=EXCLUDED."PasswordHash",
         "FailedLoginCount"=0,"LockoutCount"=0,"LockoutUntil"=NULL`,
        [userId, passwordHash]
      )

      // 3. Business Partner ("BpCode" has no unique index, so ON CONFLICT can't target it: update-else-insert)
      const existing = await c.query(
        `UPDATE mst_business_partner SET "OperationalStatus"='ACTIVE',"OnboardingStatus"='VERIFIED' WHERE "BpCode"=$1 RETURNING "Id"`,
        [v.bpCode]
      )
      const bpRes = existing.rows.length ? existing : await c.query(
        `INSERT INTO mst_business_partner ("BpCode","LegalName","TradeName","EntityType","TaxId","IsSupplier","CountryCode","DefaultCurrencyCode","OnboardingStatus","OperationalStatus","Email")
         VALUES ($1,$2,$3,$4,$5,true,'ID','IDR','VERIFIED','ACTIVE',$6)
         RETURNING "Id"`,
        [v.bpCode, v.legalName, v.tradeName, v.entityType, v.taxId, v.email.toLowerCase()]
      )
      const bpId = bpRes.rows[0].Id

      // 4. Link BP User
      await c.query(
        `INSERT INTO mst_bp_user ("BpId","UserId","UserType","AccessRole","IsActive")
         VALUES ($1,$2,'BP','ADMIN',true)
         ON CONFLICT ("BpId","UserId") DO UPDATE SET "IsActive"=true`,
        [bpId, userId]
      )

      console.log(`✓ Vendor ready: ${v.email} -> ${v.legalName} (${v.bpCode})`)
    }

    await c.query('COMMIT')
    console.log('\nAll demo accounts seeded successfully! Password for all:', DEMO_PW)
  } catch (err) {
    await c.query('ROLLBACK')
    console.error('Seeding error:', err)
    throw err
  } finally {
    c.release()
    await pool.end()
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
