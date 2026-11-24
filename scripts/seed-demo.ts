// Usage: DATABASE_URL=... npm run seed:demo
// Seeds realistic master data, demo users, roles, business partners,
// and comprehensive transactions (PR, RFQ, Quotation, PO, Contract, GR, Invoice, Payment, Cash Advance, Approvals, Notifications)
// so all demo personas have rich, interactive data to explore.
import pg from 'pg'
import bcrypt from 'bcryptjs'

const { DATABASE_URL } = process.env
if (!DATABASE_URL) throw new Error('Set DATABASE_URL in .env')

const DEMO_PW = process.env.DEMO_PASSWORD || 'Password123!'

async function run() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL })
  const c = await pool.connect()

  try {
    await c.query('BEGIN')

    // 1. Roles
    console.log('1. Setting up roles & permissions...')
    const roleAdmin = (await c.query(
      `INSERT INTO mst_role ("Code","Name","Scope") VALUES ('ADMIN','Administrator','INTERNAL')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id
    const roleBuyer = (await c.query(
      `INSERT INTO mst_role ("Code","Name","Scope") VALUES ('BUYER','Purchasing Specialist','INTERNAL')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id
    const roleApprover = (await c.query(
      `INSERT INTO mst_role ("Code","Name","Scope") VALUES ('APPROVER','Department Approver','INTERNAL')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id
    const roleFinance = (await c.query(
      `INSERT INTO mst_role ("Code","Name","Scope") VALUES ('FINANCE','Finance & Treasury','INTERNAL')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id

    for (const rId of [roleAdmin, roleBuyer, roleApprover, roleFinance]) {
      await c.query(
        `INSERT INTO mst_role_permission ("RoleId","PermissionId")
         SELECT $1,"Id" FROM mst_permission ON CONFLICT DO NOTHING`,
        [rId]
      )
    }

    // 2. Demo Users
    console.log('2. Creating demo user accounts...')
    const pwHash = await bcrypt.hash(DEMO_PW, 8)

    async function ensureUser(email: string, name: string, userType: 'INTERNAL' | 'BP', roleId?: number) {
      const uRes = await c.query(
        `INSERT INTO mst_user ("UserType","Email","DisplayName","Status")
         VALUES ($1,$2,$3,'ACTIVE')
         ON CONFLICT ("Email") DO UPDATE SET "Status"='ACTIVE',"DisplayName"=EXCLUDED."DisplayName"
         RETURNING "Id"`,
        [userType, email.toLowerCase(), name]
      )
      const uId = uRes.rows[0].Id
      await c.query(
        `INSERT INTO sys_user_credential ("UserId","PasswordHash","PasswordChangedAt")
         VALUES ($1,$2,now())
         ON CONFLICT ("UserId") DO UPDATE SET "PasswordHash"=EXCLUDED."PasswordHash","FailedLoginCount"=0,"LockoutCount"=0,"LockoutUntil"=NULL`,
        [uId, pwHash]
      )
      if (roleId) {
        await c.query(`INSERT INTO mst_user_role ("UserId","RoleId") VALUES ($1,$2) ON CONFLICT DO NOTHING`, [uId, roleId])
      }
      return uId as number
    }

    const adminId = await ensureUser('admin@purchasing.local', 'Administrator', 'INTERNAL', roleAdmin)
    const buyerId = await ensureUser('buyer@purchasing.local', 'Budi Buyer', 'INTERNAL', roleBuyer)
    const approverId = await ensureUser('approver@purchasing.local', 'Siti Approver', 'INTERNAL', roleApprover)
    const financeId = await ensureUser('finance@purchasing.local', 'Fajar Finance', 'INTERNAL', roleFinance)
    const vendorUserId = await ensureUser('vendor@supplier.com', 'PT Sumber Makmur Sentosa', 'BP')
    const mitraUserId = await ensureUser('mitra@supplier.com', 'CV Mitra Jaya Perkasa', 'BP')

    // Bypass trigger actor constraint for demo seed
    await c.query(`SET LOCAL purchasing.user_id = '${adminId}'`)
    await c.query(`SET LOCAL purchasing.recalc = '1'`)

    // 3. Business Partners (BpCode has no unique constraint, lookup first)
    console.log('3. Creating Business Partners...')
    async function ensureBp(bp: {
      bpCode: string
      legalName: string
      tradeName: string
      entityType: string
      taxId: string
      email: string
    }) {
      const existing = await c.query(`SELECT "Id" FROM mst_business_partner WHERE "BpCode"=$1 LIMIT 1`, [bp.bpCode])
      if (existing.rows.length > 0) {
        const id = existing.rows[0].Id
        await c.query(
          `UPDATE mst_business_partner SET "OperationalStatus"='ACTIVE',"OnboardingStatus"='VERIFIED',"Email"=$2 WHERE "Id"=$1`,
          [id, bp.email.toLowerCase()]
        )
        return id as number
      }
      const res = await c.query(
        `INSERT INTO mst_business_partner ("BpCode","LegalName","TradeName","EntityType","TaxId","IsSupplier","CountryCode","DefaultCurrencyCode","OnboardingStatus","OperationalStatus","Email")
         VALUES ($1,$2,$3,$4,$5,true,'ID','IDR','VERIFIED','ACTIVE',$6) RETURNING "Id"`,
        [bp.bpCode, bp.legalName, bp.tradeName, bp.entityType, bp.taxId, bp.email.toLowerCase()]
      )
      return res.rows[0].Id as number
    }

    const bp1 = await ensureBp({
      bpCode: 'VEND-001',
      legalName: 'PT Sumber Makmur Sentosa',
      tradeName: 'Sumber Makmur',
      entityType: 'PT',
      taxId: '01.234.567.8-012.000',
      email: 'vendor@supplier.com',
    })
    const bp2 = await ensureBp({
      bpCode: 'VEND-002',
      legalName: 'CV Mitra Jaya Perkasa',
      tradeName: 'Mitra Jaya',
      entityType: 'CV',
      taxId: '02.345.678.9-023.000',
      email: 'mitra@supplier.com',
    })

    await c.query(
      `INSERT INTO mst_bp_user ("BpId","UserId","UserType","AccessRole","IsActive") VALUES ($1,$2,'BP','ADMIN',true)
       ON CONFLICT ("BpId","UserId") DO UPDATE SET "IsActive"=true`,
      [bp1, vendorUserId]
    )
    await c.query(
      `INSERT INTO mst_bp_user ("BpId","UserId","UserType","AccessRole","IsActive") VALUES ($1,$2,'BP','ADMIN',true)
       ON CONFLICT ("BpId","UserId") DO UPDATE SET "IsActive"=true`,
      [bp2, mitraUserId]
    )

    // 4. Master Data
    console.log('4. Ensuring Master Data (Departments, Classes, Items, COA)...')
    const deptProc = (await c.query(
      `INSERT INTO mst_department ("Code","Name") VALUES ('PROC','Procurement & Purchasing')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id
    const deptFin = (await c.query(
      `INSERT INTO mst_department ("Code","Name") VALUES ('FIN','Finance & Treasury')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id
    const deptEng = (await c.query(
      `INSERT INTO mst_department ("Code","Name") VALUES ('ENG','Engineering & Maintenance')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id

    await c.query(
      `INSERT INTO mst_employee ("UserId","EmployeeNo","DepartmentId","JobTitle","IsActive") VALUES
       ($1, 'EMP-0001', $2, 'Procurement Director', true),
       ($3, 'EMP-0002', $2, 'Purchasing Specialist / Buyer', true),
       ($4, 'EMP-0003', $2, 'Department Head / Approver', true),
       ($5, 'EMP-0004', $6, 'Finance & Treasury Officer', true)
       ON CONFLICT ("UserId") DO UPDATE SET "DepartmentId"=EXCLUDED."DepartmentId","JobTitle"=EXCLUDED."JobTitle"`,
      [adminId, deptProc, buyerId, approverId, financeId, deptFin]
    )

    const pcGeneral = (await c.query(
      `INSERT INTO mst_purchase_class ("Code","Name") VALUES ('GENERAL','General Goods & Services')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id
    const pcRaw = (await c.query(
      `INSERT INTO mst_purchase_class ("Code","Name") VALUES ('RAW_MAT','Raw Materials & Chemicals')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id

    const uomPcs = (await c.query(
      `INSERT INTO mst_uom ("Code","Name") VALUES ('PCS','Pieces')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id
    const uomBox = (await c.query(
      `INSERT INTO mst_uom ("Code","Name") VALUES ('BOX','Box')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id
    const uomKg = (await c.query(
      `INSERT INTO mst_uom ("Code","Name") VALUES ('KG','Kilogram')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id
    const uomUnit = (await c.query(
      `INSERT INTO mst_uom ("Code","Name") VALUES ('UNIT','Unit')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id

    const catOffice = (await c.query(
      `INSERT INTO mst_category ("Code","Name") VALUES ('OFFICE_SUPPLIES','Perlengkapan & IT Kantor')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id
    const catRaw = (await c.query(
      `INSERT INTO mst_category ("Code","Name") VALUES ('RAW_MATERIAL','Bahan Baku & Material Kimia')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id
    const catService = (await c.query(
      `INSERT INTO mst_category ("Code","Name") VALUES ('SERVICES','Jasa & Pemeliharaan Gedung')
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id

    const pt30 = (await c.query(
      `INSERT INTO mst_payment_term ("Code","Name","DueDays") VALUES ('NET30','Net 30 Days',30)
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id
    const pt14 = (await c.query(
      `INSERT INTO mst_payment_term ("Code","Name","DueDays") VALUES ('NET14','Net 14 Days',14)
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`
    )).rows[0].Id

    const ccProc = (await c.query(
      `INSERT INTO mst_cost_center ("Code","Name","DepartmentId") VALUES ('CC-PROC','Cost Center Procurement', $1)
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`,
      [deptProc]
    )).rows[0].Id
    await c.query(
      `INSERT INTO mst_cost_center ("Code","Name","DepartmentId") VALUES ('CC-ENG','Cost Center Engineering', $1)
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name"`,
      [deptEng]
    )

    const itmPaper = (await c.query(
      `INSERT INTO mst_item ("Code","Name","ItemType","CategoryId","UomId") VALUES ('ITM-001','Kertas HVS A4 80gr Sinar Dunia','GOODS',$1,$2)
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`,
      [catOffice, uomBox]
    )).rows[0].Id
    const itmLaptop = (await c.query(
      `INSERT INTO mst_item ("Code","Name","ItemType","CategoryId","UomId") VALUES ('ITM-002','Laptop Lenovo ThinkPad T14 Gen 4','GOODS',$1,$2)
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`,
      [catOffice, uomUnit]
    )).rows[0].Id
    const itmResin = (await c.query(
      `INSERT INTO mst_item ("Code","Name","ItemType","CategoryId","UomId") VALUES ('ITM-003','Bahan Kimia Resin Grade A Industrial','GOODS',$1,$2)
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`,
      [catRaw, uomKg]
    )).rows[0].Id
    const itmAc = (await c.query(
      `INSERT INTO mst_item ("Code","Name","ItemType","CategoryId","UomId") VALUES ('ITM-004','Jasa Servis AC Central Tahunan','SERVICE',$1,$2)
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`,
      [catService, uomPcs]
    )).rows[0].Id

    // COA, Bank & Transaction Type (use existing seeded ones if present)
    const coaBank = (await c.query(
      `INSERT INTO mst_coa ("AccountCode","AccountName","AccountType") VALUES ('110100','Kas & Bank Operasional IDR','ASSET')
       ON CONFLICT ("AccountCode") DO UPDATE SET "AccountName"=EXCLUDED."AccountName" RETURNING "Id"`
    )).rows[0].Id
    const coaExp = (await c.query(
      `INSERT INTO mst_coa ("AccountCode","AccountName","AccountType") VALUES ('610100','Biaya Perjalanan Dinas & Transportasi','EXPENSE')
       ON CONFLICT ("AccountCode") DO UPDATE SET "AccountName"=EXCLUDED."AccountName" RETURNING "Id"`
    )).rows[0].Id

    const bankAcc = (await c.query(
      `INSERT INTO mst_company_bank_account ("Code","AccountKind","AccountNo","AccountName","CurrencyCode","CoaId","IsActive")
       VALUES ('BCA-IDR','BANK','012-3009988-11','Bank Central Asia Giro Corporate (IDR)','IDR',$1,true)
       ON CONFLICT ("Code") DO UPDATE SET "AccountNo"=EXCLUDED."AccountNo" RETURNING "Id"`,
      [coaBank]
    )).rows[0].Id

    const ttTravel = (await c.query(
      `INSERT INTO mst_transaction_type ("Module","Code","Name","RequiresSettlement","ControlCoaId","IsActive")
       VALUES ('CA','CA_TRV','Cash Advance Perjalanan Dinas',true,$1,true)
       ON CONFLICT ("Module","Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`,
      [coaExp]
    )).rows[0].Id

    // 5. Approval Templates
    console.log('5. Setting up Approval Templates...')
    const tmplPr = (await c.query(
      `INSERT INTO mst_approval_template ("Code","Name","DocType","Priority","EffectiveFrom","IsActive","CreatedBy")
       VALUES ('TMPL_PR','Template Approval PR Standar','PR',1,'2025-01-01',true,$1)
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`,
      [adminId]
    )).rows[0].Id
    await c.query(`DELETE FROM mst_approval_template_step WHERE "TemplateId"=$1`, [tmplPr])
    await c.query(
      `INSERT INTO mst_approval_template_step ("TemplateId","StepNo","Name","ApproverType","ApproverUserId","RequiredApprovals")
       VALUES ($1, 1, 'Persetujuan Head of Department', 'USER', $2, 1)`,
      [tmplPr, approverId]
    )

    const tmplInv = (await c.query(
      `INSERT INTO mst_approval_template ("Code","Name","DocType","Priority","EffectiveFrom","IsActive","CreatedBy")
       VALUES ('TMPL_INV','Template Approval Invoice AP','INV',1,'2025-01-01',true,$1)
       ON CONFLICT ("Code") DO UPDATE SET "Name"=EXCLUDED."Name" RETURNING "Id"`,
      [adminId]
    )).rows[0].Id
    await c.query(`DELETE FROM mst_approval_template_step WHERE "TemplateId"=$1`, [tmplInv])
    await c.query(
      `INSERT INTO mst_approval_template_step ("TemplateId","StepNo","Name","ApproverType","ApproverUserId","RequiredApprovals")
       VALUES ($1, 1, 'Verifikasi Invoice oleh Approver', 'USER', $2, 1)`,
      [tmplInv, approverId]
    )

    // 6. Transactions
    console.log('6. Seeding transactions across all demo roles...')

    async function createDoc(params: {
      docType: string
      docNo: string
      docDate: string
      status: string
      title: string
      bpId?: number
      deptId?: number
      ownerId: number
      amount: number
      remarks?: string
    }) {
      const res = await c.query(
        `INSERT INTO tr_document ("DocType","DocNo","DocDate","Status","Title","BpId","DepartmentId","OwnerUserId","CurrencyCode","ExchangeRate","TotalAmount","TotalAmountBase","Remarks","CreatedBy","UpdatedBy")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'IDR',1,$9,$9,$10,$8,$8)
         ON CONFLICT ("DocType","DocNo") WHERE "DocNo" IS NOT NULL
         DO UPDATE SET "Status"=EXCLUDED."Status","Title"=EXCLUDED."Title","TotalAmount"=EXCLUDED."TotalAmount","TotalAmountBase"=EXCLUDED."TotalAmountBase"
         RETURNING "Id"`,
        [params.docType, params.docNo, params.docDate, params.status, params.title, params.bpId ?? null, params.deptId ?? null, params.ownerId, params.amount, params.remarks ?? null]
      )
      return res.rows[0].Id as number
    }

    // --- TRANSACTION 1: PR-2026-0001 (APPROVED) ---
    const pr1Id = await createDoc({
      docType: 'PR',
      docNo: 'PR-2026-0001',
      docDate: '2026-11-18',
      status: 'APPROVED',
      title: 'Pengadaan Perlengkapan Kantor & IT Q4',
      deptId: deptProc,
      ownerId: buyerId,
      amount: 45000000,
      remarks: 'Kebutuhan ATK dan perlengkapan inventaris kuartal IV',
    })
    await c.query(`DELETE FROM tr_purchase_request WHERE "DocumentId"=$1`, [pr1Id])
    await c.query(
      `INSERT INTO tr_purchase_request ("DocumentId","RequiredDate","PurchaseClassId","CostCenterId","SourcingMethod","Justification")
       VALUES ($1,'2026-12-01',$2,$3,'DIRECT','Stok ATK dan perlengkapan kantor menipis')`,
      [pr1Id, pcGeneral, ccProc]
    )
    await c.query(`DELETE FROM tr_purchase_request_line WHERE "PurchaseRequestId"=$1`, [pr1Id])
    await c.query(
      `INSERT INTO tr_purchase_request_line ("PurchaseRequestId","LineNum","ItemId","Description","CategoryId","UomId","Quantity","EstimatedUnitPrice","RequiredDate")
       VALUES ($1, 1, $2, 'Kertas HVS A4 80gr Sinar Dunia', $3, $4, 100, 450000, '2026-12-01')`,
      [pr1Id, itmPaper, catOffice, uomBox]
    )

    // --- TRANSACTION 2: PR-2026-0002 (PENDING_APPROVAL - Awaiting Siti Approver) ---
    const pr2Id = await createDoc({
      docType: 'PR',
      docNo: 'PR-2026-0002',
      docDate: '2026-11-23',
      status: 'PENDING_APPROVAL',
      title: 'Pengadaan Laptop Engineer Baru',
      deptId: deptProc,
      ownerId: buyerId,
      amount: 38000000,
      remarks: '2 unit laptop development engineer tim IT',
    })
    await c.query(`DELETE FROM tr_purchase_request WHERE "DocumentId"=$1`, [pr2Id])
    await c.query(
      `INSERT INTO tr_purchase_request ("DocumentId","RequiredDate","PurchaseClassId","CostCenterId","SourcingMethod","Justification")
       VALUES ($1,'2026-12-05',$2,$3,'DIRECT','Penggantian perangkat laptop engineer yang rusak')`,
      [pr2Id, pcGeneral, ccProc]
    )
    await c.query(`DELETE FROM tr_purchase_request_line WHERE "PurchaseRequestId"=$1`, [pr2Id])
    await c.query(
      `INSERT INTO tr_purchase_request_line ("PurchaseRequestId","LineNum","ItemId","Description","CategoryId","UomId","Quantity","EstimatedUnitPrice","RequiredDate")
       VALUES ($1, 1, $2, 'Laptop Lenovo ThinkPad T14 Gen 4', $3, $4, 2, 19000000, '2026-12-05')`,
      [pr2Id, itmLaptop, catOffice, uomUnit]
    )
    await c.query(`DELETE FROM tr_approval_request WHERE "DocumentId"=$1`, [pr2Id])
    const reqPr2 = (await c.query(
      `INSERT INTO tr_approval_request ("DocumentId","TemplateId","RoundNo","Status") VALUES ($1,$2,1,'PENDING') RETURNING "Id"`,
      [pr2Id, tmplPr]
    )).rows[0].Id
    await c.query(
      `INSERT INTO tr_approval_task ("ApprovalRequestId","StepNo","AssigneeUserId","Status","ReceivedAt")
       VALUES ($1, 1, $2, 'PENDING', now())`,
      [reqPr2, approverId]
    )

    // --- TRANSACTION 3: PR-2026-0003 (DRAFT) ---
    const pr3Id = await createDoc({
      docType: 'PR',
      docNo: 'PR-2026-0003',
      docDate: '2026-11-24',
      status: 'DRAFT',
      title: 'Pengadaan Bahan Baku Resin Kimia',
      deptId: deptProc,
      ownerId: buyerId,
      amount: 95000000,
      remarks: 'Draft usulan pengadaan bahan baku kimia pabrik',
    })
    await c.query(`DELETE FROM tr_purchase_request WHERE "DocumentId"=$1`, [pr3Id])
    await c.query(
      `INSERT INTO tr_purchase_request ("DocumentId","RequiredDate","PurchaseClassId","CostCenterId","SourcingMethod","Justification")
       VALUES ($1,'2026-12-15',$2,$3,'RFQ','Pasokan bahan resin awal tahun 2027')`,
      [pr3Id, pcRaw, ccProc]
    )
    await c.query(`DELETE FROM tr_purchase_request_line WHERE "PurchaseRequestId"=$1`, [pr3Id])
    await c.query(
      `INSERT INTO tr_purchase_request_line ("PurchaseRequestId","LineNum","ItemId","Description","CategoryId","UomId","Quantity","EstimatedUnitPrice","RequiredDate")
       VALUES ($1, 1, $2, 'Bahan Kimia Resin Grade A Industrial', $3, $4, 1000, 95000, '2026-12-15')`,
      [pr3Id, itmResin, catRaw, uomKg]
    )

    // --- TRANSACTION 4: RFQ-2026-0001 (PUBLISHED Tender) ---
    const rfq1Id = await createDoc({
      docType: 'RFQ',
      docNo: 'RFQ-2026-0001',
      docDate: '2026-11-20',
      status: 'PUBLISHED',
      title: 'Tender Pengadaan Perangkat IT & Printer',
      deptId: deptProc,
      ownerId: buyerId,
      amount: 150000000,
      remarks: 'Tender terbuka untuk rekanan terdaftar pengadaan perangkat IT kantor',
    })
    await c.query(`DELETE FROM tr_rfq WHERE "DocumentId"=$1`, [rfq1Id])
    await c.query(
      `INSERT INTO tr_rfq ("DocumentId","SubmissionDeadline","QuoteValidityDays","EvaluationMethod","Terms","PublishedAt")
       VALUES ($1, now() + interval '14 days', 30, 'LOWEST_PRICE', 'Garansi resmi 3 tahun, pengiriman franco Jakarta.', now() - interval '2 days')`,
      [rfq1Id]
    )
    await c.query(`DELETE FROM tr_rfq_line WHERE "RfqId"=$1`, [rfq1Id])
    const rfq1LineId = (await c.query(
      `INSERT INTO tr_rfq_line ("RfqId","LineNum","ItemId","Description","CategoryId","UomId","Quantity","Specification")
       VALUES ($1, 1, $2, 'Laptop Lenovo ThinkPad T14 Gen 4', $3, $4, 5, 'Intel i7 Gen 13, RAM 32GB, SSD 1TB NVMe')
       RETURNING "Id"`,
      [rfq1Id, itmLaptop, catOffice, uomUnit]
    )).rows[0].Id
    await c.query(`DELETE FROM tr_rfq_participant WHERE "RfqId"=$1`, [rfq1Id])
    const part1Id = (await c.query(
      `INSERT INTO tr_rfq_participant ("RfqId","BpId","InvitedBy") VALUES ($1,$2,$3) RETURNING "Id"`,
      [rfq1Id, bp1, buyerId]
    )).rows[0].Id
    const part2Id = (await c.query(
      `INSERT INTO tr_rfq_participant ("RfqId","BpId","InvitedBy") VALUES ($1,$2,$3) RETURNING "Id"`,
      [rfq1Id, bp2, buyerId]
    )).rows[0].Id

    // --- TRANSACTION 5: QUO-2026-0001 (SUBMITTED by PT Sumber Makmur) ---
    const quo1Id = await createDoc({
      docType: 'QUO',
      docNo: 'QUO-2026-0001',
      docDate: '2026-11-22',
      status: 'SUBMITTED',
      title: 'Penawaran Tender Pengadaan Perangkat IT (PT Sumber Makmur)',
      bpId: bp1,
      ownerId: vendorUserId,
      amount: 120000000,
      remarks: 'Penawaran resmi dengan diskon quantity 5% dan garansi distributor resmi',
    })
    await c.query(`DELETE FROM tr_quotation WHERE "DocumentId"=$1`, [quo1Id])
    await c.query(
      `INSERT INTO tr_quotation ("DocumentId","RfqParticipantId","RevisionNo","IsLatest","BpReference","ValidUntil","PaymentTermId","DeliveryTerms")
       VALUES ($1,$2,1,true,'QUO-SM-2026-088','2026-12-31',$3,'Franco Gudang Pembeli')`,
      [quo1Id, part1Id, pt30]
    )
    await c.query(`DELETE FROM tr_quotation_line WHERE "QuotationId"=$1`, [quo1Id])
    await c.query(
      `INSERT INTO tr_quotation_line ("QuotationId","RfqLineId","Quantity","UnitPrice","DiscountPercent","LineAmount")
       VALUES ($1, $2, 5, 24000000, 0, 120000000)`,
      [quo1Id, rfq1LineId]
    )

    // --- TRANSACTION 6: QUO-2026-0002 (DRAFT by CV Mitra Jaya) ---
    const quo2Id = await createDoc({
      docType: 'QUO',
      docNo: 'QUO-2026-0002',
      docDate: '2026-11-24',
      status: 'DRAFT',
      title: 'Draft Penawaran Layanan IT & Printer (CV Mitra Jaya)',
      bpId: bp2,
      ownerId: mitraUserId,
      amount: 32000000,
      remarks: 'Draft penawaran harga alternatif perangkat IT',
    })
    await c.query(`DELETE FROM tr_quotation WHERE "DocumentId"=$1`, [quo2Id])
    await c.query(
      `INSERT INTO tr_quotation ("DocumentId","RfqParticipantId","RevisionNo","IsLatest","BpReference","ValidUntil","PaymentTermId","DeliveryTerms")
       VALUES ($1,$2,1,true,'QUO-MJ-2026-012','2026-12-25',$3,'Loco Gudang Penjual')`,
      [quo2Id, part2Id, pt14]
    )
    await c.query(`DELETE FROM tr_quotation_line WHERE "QuotationId"=$1`, [quo2Id])
    await c.query(
      `INSERT INTO tr_quotation_line ("QuotationId","RfqLineId","Quantity","UnitPrice","DiscountPercent","LineAmount")
       VALUES ($1, $2, 2, 16000000, 0, 32000000)`,
      [quo2Id, rfq1LineId]
    )

    // --- TRANSACTION 7: CTR-2026-0001 (Contract APPROVED with PT Sumber Makmur) ---
    const ctr1Id = await createDoc({
      docType: 'CTR',
      docNo: 'CTR-2026-0001',
      docDate: '2026-01-15',
      status: 'APPROVED',
      title: 'Perjanjian Kontrak Payung Pasokan Resin 2026',
      bpId: bp1,
      ownerId: buyerId,
      amount: 500000000,
      remarks: 'Kontrak payung pengadaan bahan baku resin selama tahun 2026',
    })
    await c.query(`DELETE FROM tr_purchase_contract WHERE "DocumentId"=$1`, [ctr1Id])
    await c.query(
      `INSERT INTO tr_purchase_contract ("DocumentId","AgreementType","StartDate","EndDate","TargetAmount","PurchaseClassId","PaymentTermId","BpReference","Terms")
       VALUES ($1,'AMOUNT','2026-01-01','2026-12-31',500000000,$2,$3,'CTR-REF-SM-001','Pengiriman bertahap sesuai PO rilis tiap bulan.')`,
      [ctr1Id, pcRaw, pt30]
    )
    await c.query(`DELETE FROM tr_purchase_contract_line WHERE "ContractId"=$1`, [ctr1Id])
    await c.query(
      `INSERT INTO tr_purchase_contract_line ("ContractId","LineNum","ItemId","CategoryId","Description","UomId","TargetQty","UnitPrice")
       VALUES ($1, 1, $2, $3, 'Bahan Kimia Resin Grade A Industrial', $4, 5000, 100000)`,
      [ctr1Id, itmResin, catRaw, uomKg]
    )

    // --- TRANSACTION 8: PO-2026-0001 (ISSUED to PT Sumber Makmur - Ready to Acknowledge) ---
    const po1Id = await createDoc({
      docType: 'PO',
      docNo: 'PO-2026-0001',
      docDate: '2026-11-20',
      status: 'ISSUED',
      title: 'PO Pengadaan Mesin & Material Produksi',
      bpId: bp1,
      ownerId: buyerId,
      amount: 125000000,
      remarks: 'Purchase Order resmi bahan baku industri termin 1',
    })
    await c.query(`DELETE FROM tr_purchase_order WHERE "DocumentId"=$1`, [po1Id])
    await c.query(
      `INSERT INTO tr_purchase_order ("DocumentId","PurchaseClassId","PaymentTermId","PoType","BpReference","ShippingMethod","DeliveryDate","SubtotalAmount","GrandTotal","IssuedAt")
       VALUES ($1,$2,$3,'STANDARD','PO-REF-2026-01','TRUCK_CONTAINER','2026-12-10',125000000,125000000,now() - interval '2 days')`,
      [po1Id, pcRaw, pt30]
    )
    await c.query(`DELETE FROM tr_purchase_order_line WHERE "PurchaseOrderId"=$1`, [po1Id])
    await c.query(
      `INSERT INTO tr_purchase_order_line ("PurchaseOrderId","LineNum","ItemId","Description","UomId","Quantity","UnitPrice","LineAmount")
       VALUES ($1, 1, $2, 'Bahan Kimia Resin Grade A Industrial', $3, 1250, 100000, 125000000)`,
      [po1Id, itmResin, uomKg]
    )

    // --- TRANSACTION 9: PO-2026-0002 (ACKNOWLEDGED by PT Sumber Makmur) ---
    const po2Id = await createDoc({
      docType: 'PO',
      docNo: 'PO-2026-0002',
      docDate: '2026-11-15',
      status: 'ACKNOWLEDGED',
      title: 'PO Pengadaan Alat Tulis & Kertas Kantor',
      bpId: bp1,
      ownerId: buyerId,
      amount: 18500000,
      remarks: 'PO perlengkapan kertas dan ATK kantor pusat',
    })
    await c.query(`DELETE FROM tr_purchase_order WHERE "DocumentId"=$1`, [po2Id])
    await c.query(
      `INSERT INTO tr_purchase_order ("DocumentId","PurchaseClassId","PaymentTermId","PoType","BpReference","ShippingMethod","DeliveryDate","SubtotalAmount","GrandTotal","IssuedAt","AcknowledgedAt","AcknowledgedBy")
       VALUES ($1,$2,$3,'STANDARD','PO-REF-2026-02','EXPEDITION','2026-11-25',18500000,18500000,now() - interval '7 days', now() - interval '6 days', $4)`,
      [po2Id, pcGeneral, pt14, vendorUserId]
    )
    await c.query(`DELETE FROM tr_purchase_order_line WHERE "PurchaseOrderId"=$1`, [po2Id])
    const po2LineId = (await c.query(
      `INSERT INTO tr_purchase_order_line ("PurchaseOrderId","LineNum","ItemId","Description","UomId","Quantity","UnitPrice","LineAmount")
       VALUES ($1, 1, $2, 'Kertas HVS A4 80gr Sinar Dunia', $3, 50, 370000, 18500000)
       RETURNING "Id"`,
      [po2Id, itmPaper, uomBox]
    )).rows[0].Id

    // --- TRANSACTION 10: PO-2026-0003 (ISSUED to CV Mitra Jaya) ---
    const po3Id = await createDoc({
      docType: 'PO',
      docNo: 'PO-2026-0003',
      docDate: '2026-11-22',
      status: 'ISSUED',
      title: 'PO Jasa Pemeliharaan AC Central Tahunan',
      bpId: bp2,
      ownerId: buyerId,
      amount: 15000000,
      remarks: 'Perawatan rutin AC Central gedung kantor pusat',
    })
    await c.query(`DELETE FROM tr_purchase_order WHERE "DocumentId"=$1`, [po3Id])
    await c.query(
      `INSERT INTO tr_purchase_order ("DocumentId","PurchaseClassId","PaymentTermId","PoType","BpReference","ShippingMethod","DeliveryDate","SubtotalAmount","GrandTotal","IssuedAt")
       VALUES ($1,$2,$3,'SERVICE','PO-REF-2026-03','DIRECT_SERVICE','2026-12-01',15000000,15000000,now() - interval '1 days')`,
      [po3Id, pcGeneral, pt14]
    )
    await c.query(`DELETE FROM tr_purchase_order_line WHERE "PurchaseOrderId"=$1`, [po3Id])
    await c.query(
      `INSERT INTO tr_purchase_order_line ("PurchaseOrderId","LineNum","ItemId","Description","UomId","Quantity","UnitPrice","LineAmount")
       VALUES ($1, 1, $2, 'Jasa Servis AC Central Tahunan', $3, 1, 15000000, 15000000)`,
      [po3Id, itmAc, uomPcs]
    )

    // --- TRANSACTION 11: GR-2026-0001 (POSTED Goods Receipt from PO-2026-0002) ---
    const gr1Id = await createDoc({
      docType: 'GR',
      docNo: 'GR-2026-0001',
      docDate: '2026-11-21',
      status: 'POSTED',
      title: 'Penerimaan Barang Kertas Kantor (SJ-SM-2026-889)',
      bpId: bp1,
      ownerId: buyerId,
      amount: 18500000,
      remarks: 'Barang diterima lengkap dan lolos pengecekan QC gudang',
    })
    await c.query(`DELETE FROM tr_goods_receipt WHERE "DocumentId"=$1`, [gr1Id])
    await c.query(
      `INSERT INTO tr_goods_receipt ("DocumentId","ReceiptKind","PurchaseOrderId","ReceivedDate","ReceivedBy","DeliveryNoteNo","VehiclePlateNo","DriverName","Location")
       VALUES ($1,'RECEIPT',$2,'2026-11-21',$3,'SJ-SM-2026-889','B 9283 SAA','Supardi','Gudang Pusat Cikarang')`,
      [gr1Id, po2Id, buyerId]
    )
    await c.query(`DELETE FROM tr_goods_receipt_line WHERE "GoodsReceiptId"=$1`, [gr1Id])
    await c.query(
      `INSERT INTO tr_goods_receipt_line ("GoodsReceiptId","LineNum","PurchaseOrderLineId","ReceivedQty","AcceptedQty","RejectedQty")
       VALUES ($1, 1, $2, 50, 50, 0)`,
      [gr1Id, po2LineId]
    )

    // --- TRANSACTION 12: INV-2026-0001 (PENDING_APPROVAL Invoice from PT Sumber Makmur) ---
    const inv1Id = await createDoc({
      docType: 'INV',
      docNo: 'INV-2026-0001',
      docDate: '2026-11-23',
      status: 'PENDING_APPROVAL',
      title: 'Tagihan Pembelian Material Resin PT Sumber Makmur',
      bpId: bp1,
      ownerId: vendorUserId,
      amount: 125000000,
      remarks: 'Invoice tagihan pengadaan resin sesuai PO-2026-0001',
    })
    await c.query(`DELETE FROM tr_ap_invoice WHERE "DocumentId"=$1`, [inv1Id])
    await c.query(
      `INSERT INTO tr_ap_invoice ("DocumentId","InvoiceKind","BpId","PurchaseOrderId","BpInvoiceNo","InvoiceDate","DueDate","TransactionAmount","TaxBaseAmount","NetPayable")
       VALUES ($1,'INVOICE',$2,$3,'INV-SM-2026-001','2026-11-23','2026-12-23',125000000,125000000,125000000)`,
      [inv1Id, bp1, po1Id]
    )
    await c.query(`DELETE FROM tr_ap_invoice_line WHERE "InvoiceId"=$1`, [inv1Id])
    await c.query(
      `INSERT INTO tr_ap_invoice_line ("InvoiceId","LineNum","Description","Quantity","UnitPrice","LineAmount")
       VALUES ($1, 1, 'Bahan Kimia Resin Grade A Industrial', 1250, 100000, 125000000)`,
      [inv1Id]
    )
    await c.query(`DELETE FROM tr_approval_request WHERE "DocumentId"=$1`, [inv1Id])
    const reqInv1 = (await c.query(
      `INSERT INTO tr_approval_request ("DocumentId","TemplateId","RoundNo","Status") VALUES ($1,$2,1,'PENDING') RETURNING "Id"`,
      [inv1Id, tmplInv]
    )).rows[0].Id
    await c.query(
      `INSERT INTO tr_approval_task ("ApprovalRequestId","StepNo","AssigneeUserId","Status","ReceivedAt")
       VALUES ($1, 1, $2, 'PENDING', now())`,
      [reqInv1, approverId]
    )

    // --- TRANSACTION 13: INV-2026-0002 (APPROVED Invoice for PO-2026-0002) ---
    const inv2Id = await createDoc({
      docType: 'INV',
      docNo: 'INV-2026-0002',
      docDate: '2026-11-21',
      status: 'APPROVED',
      title: 'Tagihan Perlengkapan Kantor Sesuai PO-2026-0002',
      bpId: bp1,
      ownerId: vendorUserId,
      amount: 18500000,
      remarks: 'Invoice pelunasan ATK kertas kantor',
    })
    await c.query(`DELETE FROM tr_ap_invoice WHERE "DocumentId"=$1`, [inv2Id])
    await c.query(
      `INSERT INTO tr_ap_invoice ("DocumentId","InvoiceKind","BpId","PurchaseOrderId","BpInvoiceNo","InvoiceDate","DueDate","TransactionAmount","TaxBaseAmount","NetPayable")
       VALUES ($1,'INVOICE',$2,$3,'INV-SM-2026-002','2026-11-21','2026-12-05',18500000,18500000,18500000)`,
      [inv2Id, bp1, po2Id]
    )
    await c.query(`DELETE FROM tr_ap_invoice_line WHERE "InvoiceId"=$1`, [inv2Id])
    await c.query(
      `INSERT INTO tr_ap_invoice_line ("InvoiceId","LineNum","Description","Quantity","UnitPrice","LineAmount")
       VALUES ($1, 1, 'Kertas HVS A4 80gr Sinar Dunia', 50, 370000, 18500000)`,
      [inv2Id]
    )

    // --- TRANSACTION 14: PAY-2026-0001 (POSTED Outgoing Payment by Finance for INV-2026-0002) ---
    const pay1Id = await createDoc({
      docType: 'PAY',
      docNo: 'PAY-2026-0001',
      docDate: '2026-11-22',
      status: 'POSTED',
      title: 'Pembayaran Pelunasan PO Kertas Kantor INV-2026-0002',
      bpId: bp1,
      ownerId: financeId,
      amount: 18500000,
      remarks: 'Transfer via BCA Giro Operasional ke rekening PT Sumber Makmur',
    })
    await c.query(`DELETE FROM tr_payment WHERE "DocumentId"=$1`, [pay1Id])
    await c.query(
      `INSERT INTO tr_payment ("DocumentId","Purpose","PayeeType","CompanyBankAccountId","PaymentMethod","PaidDate","BankBatchNo","BankReference")
       VALUES ($1,'AP_INVOICE','BP',$2,'TRANSFER','2026-11-22','BATCH-20261122-01','TRF-BCA-881920')`,
      [pay1Id, bankAcc]
    )
    await c.query(`DELETE FROM tr_payment_allocation WHERE "PaymentId"=$1`, [pay1Id])
    await c.query(
      `INSERT INTO tr_payment_allocation ("PaymentId","TargetDocumentId","AmountApplied","AmountInPaymentCurrency")
       VALUES ($1,$2,18500000,18500000)`,
      [pay1Id, inv2Id]
    )

    // --- TRANSACTION 15: CA-2026-0001 (DISBURSED Cash Advance Budi Buyer) ---
    const ca1Id = await createDoc({
      docType: 'CA',
      docNo: 'CA-2026-0001',
      docDate: '2026-11-19',
      status: 'DISBURSED',
      title: 'Kasbon Perjalanan Dinas Audit Pabrik Surabaya',
      deptId: deptProc,
      ownerId: buyerId,
      amount: 7500000,
      remarks: 'Uang muka perjalanan dinas audit kesiapan vendor dan pabrik Surabaya',
    })
    await c.query(`DELETE FROM tr_cash_advance WHERE "DocumentId"=$1`, [ca1Id])
    await c.query(
      `INSERT INTO tr_cash_advance ("DocumentId","EmployeeUserId","TransactionTypeId","Purpose","RequiredDate")
       VALUES ($1,$2,$3,'Audit vendor pabrik Surabaya','2026-11-20')`,
      [ca1Id, buyerId, ttTravel]
    )
    await c.query(`DELETE FROM tr_expense_line WHERE "DocumentId"=$1`, [ca1Id])
    await c.query(
      `INSERT INTO tr_expense_line ("DocumentId","LineNum","CoaId","CostCenterId","Description","Amount","ExpenseDate")
       VALUES ($1, 1, $2, $3, 'Tiket pesawat & akomodasi hotel audit 3 hari', 7500000, '2026-11-20')`,
      [ca1Id, coaExp, ccProc]
    )

    // 7. Notifications
    console.log('7. Creating interactive notifications for all demo personas...')
    await c.query(
      `DELETE FROM tr_notification WHERE "RecipientUserId" IN ($1,$2,$3,$4,$5,$6)`,
      [adminId, buyerId, approverId, financeId, vendorUserId, mitraUserId]
    )

    const notifs = [
      { uid: approverId, docId: pr2Id, type: 'APPROVAL_REQUESTED', title: 'Tugas Approval Baru: PR-2026-0002', body: 'Dokumen PR-2026-0002 (Pengadaan Laptop Engineer Baru - Rp 38.000.000) membutuhkan persetujuan Anda.' },
      { uid: approverId, docId: inv1Id, type: 'APPROVAL_REQUESTED', title: 'Tugas Approval Baru: INV-2026-0001', body: 'Dokumen INV-2026-0001 (Tagihan Material Resin - Rp 125.000.000) diajukan oleh PT Sumber Makmur.' },
      { uid: buyerId, docId: pr1Id, type: 'APPROVAL_COMPLETED', title: 'Persetujuan Selesai: PR-2026-0001', body: 'Purchase Request PR-2026-0001 telah disetujui penuh oleh Department Head.' },
      { uid: buyerId, docId: quo1Id, type: 'QUOTATION_SUBMITTED', title: 'Penawaran Masuk: QUO-2026-0001', body: 'PT Sumber Makmur Sentosa telah mengirimkan penawaran harga untuk tender RFQ-2026-0001.' },
      { uid: buyerId, docId: po2Id, type: 'PO_ACKNOWLEDGED', title: 'PO Dikonfirmasi Rekanan: PO-2026-0002', body: 'PT Sumber Makmur Sentosa telah melakukan konfirmasi kesanggupan pengiriman untuk PO-2026-0002.' },
      { uid: financeId, docId: inv1Id, type: 'INVOICE_SUBMITTED', title: 'Invoice Tagihan Masuk: INV-2026-0001', body: 'Tagihan vendor INV-2026-0001 senilai Rp 125.000.000 siap untuk proses verifikasi finance.' },
      { uid: financeId, docId: ca1Id, type: 'CA_DISBURSED', title: 'Disbursement Selesai: CA-2026-0001', body: 'Pencairan kasbon perjalanan dinas Budi Buyer sebesar Rp 7.500.000 telah berhasil dibukukan.' },
      { uid: vendorUserId, docId: po1Id, type: 'PO_ISSUED', title: 'Pesanan Baru (PO Diterbitkan): PO-2026-0001', body: 'Perusahaan telah menerbitkan PO-2026-0001 (Rp 125.000.000). Silakan lakukan konfirmasi di portal PO.' },
      { uid: vendorUserId, docId: rfq1Id, type: 'RFQ_INVITATION', title: 'Undangan Tender Pengadaan: RFQ-2026-0001', body: 'Anda diundang untuk mengajukan penawaran harga pada Tender Perangkat IT & Printer.' },
      { uid: vendorUserId, docId: pay1Id, type: 'PAYMENT_RECEIVED', title: 'Pembayaran Diterima: Pelunasan INV-2026-0002', body: 'Pembayaran sebesar Rp 18.500.000 untuk tagihan ATK kertas kantor telah ditransfer ke rekening Anda.' },
      { uid: mitraUserId, docId: po3Id, type: 'PO_ISSUED', title: 'Pesanan Baru (PO Diterbitkan): PO-2026-0003', body: 'PO-2026-0003 senilai Rp 15.000.000 untuk Jasa Pemeliharaan AC Central telah diterbitkan.' },
      { uid: mitraUserId, docId: rfq1Id, type: 'RFQ_INVITATION', title: 'Undangan Tender Pengadaan: RFQ-2026-0001', body: 'Anda diundang untuk berpartisipasi dalam RFQ-2026-0001 Tender Perangkat IT & Printer.' },
      { uid: adminId, docId: pr2Id, type: 'SYSTEM_EVENT', title: 'Audit Trail: Aktivitas Transaksi Baru', body: '15 dokumen transaksi operasional purchasing dan portal vendor aktif dalam sistem.' },
    ]

    for (const n of notifs) {
      await c.query(
        `INSERT INTO tr_notification ("RecipientUserId","DocumentId","EventType","Title","Body")
         VALUES ($1,$2,$3,$4,$5)`,
        [n.uid, n.docId, n.type, n.title, n.body]
      )
    }

    await c.query('COMMIT')
    console.log('\n======================================================')
    console.log('SUCCESS: All demo users & 15 transactions seeded!')
    console.log('Internal Accounts: admin, buyer, approver, finance')
    console.log('Vendor Accounts: vendor (PT Sumber Makmur), mitra (CV Mitra Jaya)')
    console.log('Password for all accounts:', DEMO_PW)
    console.log('======================================================\n')
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
