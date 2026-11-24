// Demo data through the real API: master data, approval mappings and end-to-end transactions, each done by the persona
// who would do it in real life (buyer raises, approver approves, vendor quotes, finance pays). Because every document
// goes through the same validation, numbering and approval engine as the UI, the data is consistent by construction.
//
// Usage: API_URL=https://<api> ORIGIN=https://<fe> npm run seed:flows      (defaults: local dev server)
// Needs the demo accounts first (npm run seed:demo). Masters/mappings are upserted; transactions run once
// (skipped when the sentinel PR exists; FORCE=1 runs them again).

const API = (process.env.API_URL ?? 'http://localhost:3918').replace(/\/$/, '')
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:3917'
const PW = process.env.DEMO_PASSWORD ?? 'Password123!'
const SENTINEL_PR = 'Pengadaan ATK Kantor Q4 2026'

type Json = any
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const day = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
const log = (...a: unknown[]) => console.log(...a)

class Client {
  private cookies = new Map<string, string>()
  constructor(public email: string) {}

  async login() {
    await this.call('POST', '/auth/login', { email: this.email, password: PW }, false)
    return this
  }

  async call(method: string, path: string, body?: unknown, relogin = true): Promise<Json> {
    for (let attempt = 0; ; attempt++) {
      const isForm = body instanceof FormData // multipart: fetch sets the boundary header itself
      const res = await fetch(API + '/api' + path, {
        method,
        headers: {
          ...(isForm ? {} : { 'content-type': 'application/json' }),
          origin: ORIGIN,
          'user-agent': 'purchasing-seed/1.0',
          cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        },
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      })
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(';')
        const i = pair!.indexOf('=')
        this.cookies.set(pair!.slice(0, i), pair!.slice(i + 1))
      }
      if (res.status === 429 && attempt < 8) {
        const wait = Number(res.headers.get('retry-after') ?? 15) * 1000
        log(`   … rate limited, waiting ${wait / 1000}s`)
        await sleep(wait)
        continue
      }
      // Workers Free kills requests over the CPU budget (503 "exceeded resource limits"); the DB rolls the transaction back, so retry
      if (res.status === 503 && attempt < 4) {
        log(`   … ${method} ${path} hit the Worker CPU limit, retrying`)
        await sleep(2000 * (attempt + 1))
        continue
      }
      if (res.status === 401 && relogin && attempt === 0) {
        await this.login()
        continue
      }
      const text = await res.text()
      if (!res.ok) throw new Error(`${this.email} ${method} ${path} → ${res.status} ${text.slice(0, 400)}`)
      return text ? JSON.parse(text) : {}
    }
  }
  get = (path: string) => this.call('GET', path)
  post = (path: string, body: unknown = {}) => this.call('POST', path, body)
  patch = (path: string, body: unknown) => this.call('PATCH', path, body)
  put = (path: string, body: unknown) => this.call('PUT', path, body)
}

/** List rows (first 100) matching an optional search. */
const list = async (c: Client, path: string, q?: string) =>
  ((await c.get(`${path}${path.includes('?') ? '&' : '?'}pageSize=100${q ? `&q=${encodeURIComponent(q)}` : ''}`)).data ?? []) as Json[]

/** Find a master row by code or create it. */
async function ensureCode(c: Client, path: string, body: Json, key = 'code') {
  const hit = (await list(c, path, body[key])).find((r) => String(r[key]).toUpperCase() === String(body[key]).toUpperCase())
  if (hit) return hit
  return (await c.post(path, body)).data
}

/** Create + submit a document; returns its PublicId. */
async function createDoc(c: Client, path: string, body: Json, submit = true) {
  const { data } = await c.post(path, body)
  if (submit) await c.post(`${path}/${data.id}/submit`)
  log(`   + ${path} ${data.docNo ?? ''} "${body.title}"${submit ? ' (submitted)' : ' (draft)'}`)
  return data.id as string
}

/** The given approver decides their pending task on a document. */
async function decide(c: Client, docId: string, decision: 'APPROVE' | 'REJECT' | 'RETURN' = 'APPROVE', remarks?: string) {
  const tasks = await list(c, '/approvals/tasks')
  const t = tasks.find((x) => x.documentId === docId && x.status === 'PENDING')
  if (!t) {
    // some document types skip approval in the status matrix (e.g. RFQ DRAFT → PUBLISHED): nothing to decide
    const doc = (await c.get(`/documents/${docId}`)).data
    if (doc.status !== 'PENDING_APPROVAL') return log(`     (${doc.docNo} needs no approval: ${doc.status})`)
    throw new Error(`${c.email}: no pending task on ${doc.docNo} (${tasks.length} tasks in inbox)`)
  }
  const r = await c.post(`/approvals/tasks/${t.id}/decide`, { decision, remarks })
  log(`     ${c.email.split('@')[0]} ${decision} ${t.docNo ?? ''} step ${t.stepNo} → ${r.data?.documentStatus ?? r.documentStatus ?? ''}`)
}

/** A small but valid one-page PDF (real xref offsets) so demo attachments open in any viewer. */
function demoPdf(lines: string[]) {
  const esc = (s: string) => s.replace(/[\\()]/g, (m) => '\\' + m)
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 56 ${780 - i * 22} Td (${esc(l)}) Tj ET`).join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets = objs.map((o, i) => { const at = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(out)
}

async function attach(c: Client, docId: string | undefined, fileName: string, category: string, description: string, lines: string[]) {
  if (!docId || ((await c.get(`/documents/${docId}/attachments`)).data ?? []).length) return
  const fd = new FormData()
  fd.set('file', new File([demoPdf(lines)], fileName, { type: 'application/pdf' }))
  fd.set('category', category)
  fd.set('description', description)
  await c.call('POST', `/documents/${docId}/attachments`, fd)
  log(`   + attachment ${fileName}`)
}

async function main() {
  log(`Seeding via ${API}`)
  const admin = await new Client('admin@purchasing.local').login()
  const buyer = await new Client('buyer@purchasing.local').login()
  const approver = await new Client('approver@purchasing.local').login()
  const finance = await new Client('finance@purchasing.local').login()
  const vendor = await new Client('vendor@supplier.com').login()
  const mitra = await new Client('mitra@supplier.com').login()

  const users = Object.fromEntries((await list(admin, '/users')).map((u) => [u.email, u.id]))
  const roles = Object.fromEntries((await list(admin, '/roles')).map((r) => [r.code, r.id]))
  for (const e of ['admin@purchasing.local', 'buyer@purchasing.local', 'approver@purchasing.local', 'finance@purchasing.local'])
    if (!users[e]) throw new Error(`Missing demo user ${e}: run npm run seed:demo first`)

  // ---------------------------------------------------------------- 1. master data
  log('1. Master data')
  const dept: Record<string, number> = {}
  for (const [code, name] of [['GA', 'General Affairs'], ['PROC', 'Procurement'], ['FIN', 'Finance & Accounting'], ['OPS', 'Operations'], ['IT', 'Information Technology'], ['HR', 'Human Resources']])
    dept[code!] = (await ensureCode(admin, '/departments', { code, name })).id

  const cc: Record<string, number> = {}
  for (const [code, name, d] of [['CC-GA', 'General Affairs', 'GA'], ['CC-PROC', 'Procurement', 'PROC'], ['CC-FIN', 'Finance', 'FIN'], ['CC-OPS', 'Operations Plant', 'OPS'], ['CC-IT', 'IT Infrastructure', 'IT'], ['CC-HR', 'Human Resources', 'HR']])
    cc[code!] = (await ensureCode(admin, '/cost-centers', { code, name, departmentId: dept[d!] })).id

  // employees + reporting lines (SUPERIOR approval steps resolve through these)
  const employees = (await list(admin, '/employees')).map((e) => e.employeeNo)
  for (const [email, no, d, title, sup] of [
    ['admin@purchasing.local', 'EMP-0001', 'GA', 'Procurement & GA Director', null],
    ['approver@purchasing.local', 'EMP-0002', 'OPS', 'Operations Manager', 'admin@purchasing.local'],
    ['buyer@purchasing.local', 'EMP-0003', 'PROC', 'Senior Buyer', 'approver@purchasing.local'],
    ['finance@purchasing.local', 'EMP-0004', 'FIN', 'Finance Supervisor', 'approver@purchasing.local'],
  ] as const) {
    if (employees.includes(no)) continue
    await admin.post('/employees', { userId: users[email], employeeNo: no, departmentId: dept[d], jobTitle: title, superiorId: sup ? users[sup] : null, joinDate: '2022-01-10' })
  }

  const uom: Record<string, number> = {}
  for (const [code, name] of [['PCS', 'Pieces'], ['UNIT', 'Unit'], ['BOX', 'Box'], ['RIM', 'Rim'], ['PAK', 'Pak'], ['SET', 'Set'], ['KG', 'Kilogram'], ['LTR', 'Liter'], ['MTR', 'Meter'], ['DRUM', 'Drum'], ['JAM', 'Jam (hour)'], ['BLN', 'Bulan (month)'], ['LOT', 'Lot']])
    uom[code!] = (await ensureCode(admin, '/uoms', { code, name })).id

  const cat: Record<string, number> = {}
  for (const [code, name] of [['GEN', 'General Goods'], ['ATK', 'Alat Tulis Kantor'], ['IT-HW', 'IT Hardware'], ['IT-SW', 'IT Software & License'], ['FURN', 'Furniture'], ['MRO', 'Maintenance, Repair & Operations'], ['RAW', 'Raw Material'], ['PACK', 'Packaging'], ['SVC-CLN', 'Jasa Kebersihan'], ['SVC-CONS', 'Jasa Konsultan'], ['SAFETY', 'APD & Safety']])
    cat[code!] = (await ensureCode(admin, '/categories', { code, name })).id

  const tax: Record<string, number> = {}
  for (const [code, name, taxType, ratePercent] of [['PPN11', 'PPN 11%', 'VAT', '11'], ['PPN12', 'PPN 12%', 'VAT', '12'], ['PPH23-2', 'PPh 23 Jasa 2%', 'WHT', '2'], ['PPH4-2-10', 'PPh 4(2) Sewa 10%', 'WHT', '10'], ['PPH21-5', 'PPh 21 5%', 'WHT', '5']])
    tax[code!] = (await ensureCode(admin, '/tax-codes', { code, name, taxType, ratePercent, effectiveFrom: '2025-01-01' })).id

  const pc: Record<string, number> = {}
  for (const [code, name, isAsset] of [['GENERAL', 'General / Indirect Purchase', false], ['RAW_MAT', 'Raw Material', false], ['CAPEX', 'Capital Expenditure (Asset)', true], ['SERVICE', 'Services', false]] as const)
    pc[code] = (await ensureCode(admin, '/purchase-classes', { code, name, isAsset, invoicePriceTolerancePct: '2' })).id

  const item: Record<string, number> = {}
  for (const [code, name, itemType, c, u] of [
    ['ATK-KRT-A4', 'Kertas HVS A4 80gsm', 'GOODS', 'ATK', 'RIM'],
    ['ATK-PLP-HTM', 'Pulpen Gel Hitam 0.5mm', 'GOODS', 'ATK', 'BOX'],
    ['ATK-MAP-PLS', 'Map Plastik Snelhecter', 'GOODS', 'ATK', 'PAK'],
    ['IT-LPT-14', 'Laptop 14" Core i5 16GB/512GB', 'GOODS', 'IT-HW', 'UNIT'],
    ['IT-MON-24', 'Monitor LED 24"', 'GOODS', 'IT-HW', 'UNIT'],
    ['IT-LIC-O365', 'Lisensi Microsoft 365 Business (1 thn)', 'SERVICE', 'IT-SW', 'PCS'],
    ['FRN-CHR-ERG', 'Kursi Kerja Ergonomis', 'GOODS', 'FURN', 'UNIT'],
    ['RAW-RSN-PP', 'Resin Polypropylene (PP) Homopolymer', 'GOODS', 'RAW', 'KG'],
    ['RAW-PGM-BLU', 'Pigmen Biru Masterbatch', 'GOODS', 'RAW', 'KG'],
    ['PCK-CTN-40', 'Karton Box 40x30x30', 'GOODS', 'PACK', 'PCS'],
    ['MRO-OLI-HYD', 'Oli Hidrolik ISO VG 46', 'GOODS', 'MRO', 'DRUM'],
    ['SAF-HLM-STD', 'Helm Safety SNI', 'GOODS', 'SAFETY', 'PCS'],
    ['SVC-CLN-MON', 'Jasa Cleaning Service Gedung (bulanan)', 'SERVICE', 'SVC-CLN', 'BLN'],
    ['SVC-CONS-TAX', 'Jasa Konsultan Pajak', 'SERVICE', 'SVC-CONS', 'JAM'],
  ] as const)
    item[code] = (await ensureCode(admin, '/items', { code, name, itemType, categoryId: cat[c], uomId: uom[u], vatTaxCodeId: tax.PPN11 })).id

  const bank: Record<string, number> = {}
  for (const [code, name, swiftCode] of [['BCA', 'Bank Central Asia', 'CENAIDJA'], ['MANDIRI', 'Bank Mandiri', 'BMRIIDJA'], ['BNI', 'Bank Negara Indonesia', 'BNINIDJA'], ['BRI', 'Bank Rakyat Indonesia', 'BRINIDJA'], ['CIMB', 'CIMB Niaga', 'BNIAIDJA'], ['PERMATA', 'Bank Permata', 'BBBAIDJA']])
    bank[code!] = (await ensureCode(admin, '/banks', { code, name, swiftCode })).id

  for (const [code, name, appliesTo, isMandatory, hasExpiry] of [
    ['NPWP', 'NPWP Perusahaan', 'ALL', true, false], ['NIB', 'Nomor Induk Berusaha (NIB)', 'COMPANY', true, false],
    ['AKTA', 'Akta Pendirian & Perubahan', 'COMPANY', true, false], ['SPPKP', 'Surat Pengukuhan PKP', 'COMPANY', false, false],
    ['KTP-DIR', 'KTP Direktur / Pemilik', 'ALL', true, true], ['REK-KORAN', 'Rekening Koran / Buku Tabungan', 'ALL', true, false],
    ['ISO-9001', 'Sertifikat ISO 9001', 'COMPANY', false, true],
  ] as const)
    await ensureCode(admin, '/bp-document-types', { code, name, appliesTo, isMandatory, hasExpiry })

  const budgets = await list(admin, '/budgets')
  for (const [d, p, amount] of [['PROC', 'GENERAL', '750000000'], ['OPS', 'RAW_MAT', '5000000000'], ['IT', 'CAPEX', '1200000000'], ['GA', 'SERVICE', '600000000'], ['FIN', 'GENERAL', '150000000'], ['HR', 'GENERAL', '200000000']] as const) {
    if (budgets.some((b) => b.fiscalYear === 2026 && b.departmentId === dept[d] && b.purchaseClassId === pc[p])) continue
    await admin.post('/budgets', { fiscalYear: 2026, departmentId: dept[d], purchaseClassId: pc[p], amount, controlMode: 'WARN', remarks: `Anggaran ${d} 2026` })
  }

  const notes = await list(admin, '/form-notes')
  for (const [docType, body] of [
    ['PR', 'Lampirkan spesifikasi teknis dan minimal 1 referensi harga untuk PR di atas Rp 50 juta.'],
    ['RFQ', 'Batas pengiriman penawaran pukul 17.00 WIB pada tanggal deadline. Penawaran yang terlambat tidak dievaluasi.'],
    ['CTR', 'Kontrak payung berlaku maksimal 12 bulan dan wajib direview Legal sebelum ditandatangani.'],
    ['PO', 'Cantumkan nomor PO pada surat jalan dan faktur. Pengiriman ke Gudang Cikarang, Senin–Jumat 08.00–16.00.'],
  ] as const)
    if (!notes.some((n) => n.docType === docType)) await admin.post('/form-notes', { docType, body })

  for (const code of ['USD', 'SGD', 'EUR', 'JPY', 'CNY']) await admin.patch(`/currencies/${code}`, { isActive: true })
  const rates = await list(admin, '/exchange-rates')
  for (const [currencyCode, rateToBase] of [['USD', '16285.5'], ['SGD', '12180.25'], ['EUR', '17640.8'], ['JPY', '106.35'], ['CNY', '2245.7']] as const)
    if (!rates.some((r) => r.currencyCode === currencyCode && String(r.rateDate).slice(0, 10) === day()))
      await admin.post('/exchange-rates', { currencyCode, rateType: 'MIDDLE', rateDate: day(), rateToBase }).catch((e) => log('   rate skipped:', e.message.slice(0, 120)))

  // vendors: addresses, contacts, bank accounts
  const bps = Object.fromEntries((await list(admin, '/vendors')).map((b) => [b.bpCode, b.id]))
  const vendorInfo: [string, string, string, string, keyof typeof bank, string][] = [
    ['VEND-001', 'Jl. Gajah Mada No. 112, Glodok', 'Jakarta Barat', 'Hendra Wijaya', 'BCA', '5270123456'],
    ['VEND-002', 'Jl. Raya Darmo No. 45', 'Surabaya', 'Rina Kartika', 'MANDIRI', '1420098765432'],
    ['VEND-003', 'Kawasan Industri Jababeka Blok C-7', 'Bekasi', 'Agus Santoso', 'BNI', '0812345678'],
    ['VEND-004', 'Jl. Asia Afrika No. 88', 'Bandung', 'Dewi Lestari', 'BRI', '034501000123301'],
    ['VEND-005', 'Jl. Pemuda No. 21', 'Semarang', 'Bambang Prakoso', 'CIMB', '800123456700'],
  ]
  for (const [code, line1, city, contact, b, acc] of vendorInfo) {
    if (!bps[code]) continue
    const d = (await admin.get(`/vendors/${bps[code]}`)).data
    if (d.addresses?.length) continue
    await admin.patch(`/vendors/${bps[code]}`, {
      paymentTermId: (await list(admin, '/payment-terms', 'NET30'))[0]?.id,
      addresses: [{ addressType: 'HEAD', line1, city, countryCode: 'ID', isPrimary: true }],
      contacts: [{ name: contact, position: 'Sales Manager', email: `${contact.split(' ')[0]!.toLowerCase()}@${code.toLowerCase()}.example`, phone: '0812-0000-' + code.slice(-3), isPrimary: true }],
      bankAccounts: [{ bankId: bank[b], accountNo: acc, accountHolderName: d.legalName, branchName: `KCU ${city}`, currencyCode: 'IDR' }],
    })
  }

  // ---------------------------------------------------------------- 2. approval mappings
  log('2. Approval templates, mappings, backups')
  const tpls = Object.fromEntries((await list(admin, '/approval-templates')).map((t) => [t.code, t]))
  const step = (name: string, stepCode: string, approverType: string, extra: Json = {}) => ({ name, stepCode, approverType, ...extra })
  const byUser = (email: string) => ({ approverUserId: users[email] })
  const byRole = (code: string) => ({ approverRoleId: roles[code] })
  // only configure templates that have no steps yet: never rewrite a flow an admin set up (or one in use)
  const setSteps = async (id: number, steps: Json[]) => {
    if (!((await admin.get(`/approval-templates/${id}/steps`)).data ?? []).length) await admin.put(`/approval-templates/${id}/steps`, { steps })
  }
  const plan: [string, string, string, Json, Json[]][] = [
    ['PR-STD', 'PR', 'PR s/d Rp 50 juta', { maxAmountBase: '50000000' }, [step('Atasan Langsung', 'CH', 'SUPERIOR')]],
    ['PR-HIGH', 'PR', 'PR di atas Rp 50 juta', { minAmountBase: '50000000.01' }, [step('Atasan Langsung', 'CH', 'SUPERIOR'), step('Procurement Director', 'AP', 'USER', byUser('admin@purchasing.local'))]],
    ['CTR-STD', 'CTR', 'Kontrak pembelian', {}, [step('Review Atasan (mapping pembuat)', 'CH', 'PREPARER_MAPPING'), step('Procurement Director', 'AP', 'USER', byUser('admin@purchasing.local'))]],
    ['PO-STD', 'PO', 'PO s/d Rp 100 juta', { maxAmountBase: '100000000' }, [step('Manager Approval', 'AP', 'ROLE', byRole('APPROVER'))]],
    ['PO-HIGH', 'PO', 'PO di atas Rp 100 juta', { minAmountBase: '100000000.01' }, [step('Manager Approval', 'CH', 'ROLE', byRole('APPROVER')), step('Procurement Director', 'AP', 'USER', byUser('admin@purchasing.local'))]],
  ]
  for (const [code, docType, name, amount, steps] of plan) {
    const t = tpls[code] ?? (await admin.post('/approval-templates', { code, docType, name, priority: 10, effectiveFrom: '2025-01-01', ...amount })).data
    await setSteps(t.id, steps)
  }
  // finance templates come from the base migration (no steps yet)
  const finSteps: Record<string, Json[]> = {
    CA: [step('Atasan Langsung', 'CH', 'SUPERIOR'), step('Verifikasi Finance', 'AC', 'ROLE', byRole('FINANCE'))],
    STL: [step('Atasan Langsung', 'CH', 'SUPERIOR'), step('Verifikasi Finance', 'AC', 'ROLE', byRole('FINANCE'))],
    RMB: [step('Atasan Langsung', 'CH', 'SUPERIOR'), step('Verifikasi Finance', 'AC', 'ROLE', byRole('FINANCE'))],
    INV: [step('Manager Approval', 'AP', 'ROLE', byRole('APPROVER'))],
    PAY: [step('Manager Approval', 'AP', 'ROLE', byRole('APPROVER')), step('Release Pembayaran', 'RE', 'USER', byUser('admin@purchasing.local'))],
    ARI: [step('Manager Approval', 'AP', 'ROLE', byRole('APPROVER'))],
  }
  for (const t of Object.values(tpls) as Json[]) if (finSteps[t.docType] && !plan.some(([c]) => c === t.code)) await setSteps(t.id, finSteps[t.docType]!)

  const maps = await list(admin, '/approvals/mappings')
  for (const [prep, appr, docType, stepCode] of [
    ['buyer@purchasing.local', 'approver@purchasing.local', 'CTR', 'CH'],
    ['finance@purchasing.local', 'approver@purchasing.local', 'CTR', 'CH'],
    ['approver@purchasing.local', 'admin@purchasing.local', 'CTR', 'CH'],
  ] as const)
    if (!maps.some((m) => m.preparerId === users[prep] && m.approverId === users[appr] && m.docType === docType && m.stepCode === stepCode))
      await admin.post('/approvals/mappings', { preparerId: users[prep], approverId: users[appr], docType, stepCode })

  if (!(await list(admin, '/approvals/backups')).length)
    await admin.post('/approvals/backups', { approverId: users['approver@purchasing.local'], backupId: users['admin@purchasing.local'], notes: 'Backup saat Operations Manager cuti / dinas luar' })

  // ---------------------------------------------------------------- 4. attachments + reassignment (idempotent)
  const collaborate = async () => {
    log('4. Attachments & reassignment')
    const byTitle = async (c: Client, path: string, title: string) => (await list(c, path, title)).find((r) => r.title === title)?.id as string | undefined
    await attach(vendor, await byTitle(vendor, '/quotations', 'Penawaran Laptop & Monitor - Sumber Makmur'), 'Penawaran-SMS-QT-2611-031.pdf', 'QUOTATION', 'Surat penawaran resmi bertanda tangan',
      ['PT Sumber Makmur Sentosa - Surat Penawaran', 'No: SMS/QT/2611/031', 'Laptop 14" Core i5 16GB/512GB  6 unit  @ Rp 15.200.000', 'Monitor LED 24"  6 unit  @ Rp 2.290.000 (disc 2%)', 'Garansi resmi 3 tahun. Berlaku 30 hari.'])
    await attach(buyer, await byTitle(buyer, '/po', 'PO Laptop & Monitor Tim Finance/IT'), 'Spesifikasi-Laptop-Monitor.pdf', 'SPECIFICATION', 'Spesifikasi teknis minimum',
      ['Spesifikasi Teknis - Laptop & Monitor', 'CPU: Intel Core i5 gen 13 / setara', 'RAM 16GB DDR5, SSD 512GB NVMe', 'Layar 14" FHD IPS, Windows 11 Pro', 'Monitor 24" IPS FHD, HDMI + DP'])
    await attach(buyer, await byTitle(buyer, '/gr', 'Penerimaan ATK Q4'), 'Surat-Jalan-SJ-SMS-2611-0451.pdf', 'DELIVERY_NOTE', 'Surat jalan dari vendor',
      ['Surat Jalan SJ-SMS-2611-0451', 'Kepada: Gudang Cikarang', 'Kertas HVS A4 80gsm  200 rim', 'Pulpen Gel Hitam  30 box', 'Map Plastik  40 pak', 'Diterima baik, kendaraan B 9123 KXT'])
    await attach(finance, await byTitle(finance, '/ap-invoices', 'Invoice ATK Q4 - Sumber Makmur'), 'INV-SMS-2611-0778.pdf', 'INVOICE', 'Invoice asli vendor',
      ['INVOICE INV/SMS/2611/0778', 'PT Sumber Makmur Sentosa', 'Ref PO ATK Kantor Q4 2026', 'Faktur Pajak 010.000-26.00012345', 'Jatuh tempo 30 hari'])
    // outgoing payments for an approved cash advance and reimbursement (finance pays, manager + director release)
    const banks = (await finance.get('/company-banks')).data as Json[]
    for (const [purpose, path, title, payTitle] of [
      ['CASH_ADVANCE', '/cash-advances', 'Kas Bon Kunjungan Vendor Surabaya', 'Pencairan Kas Bon Surabaya'],
      ['REIMBURSEMENT', '/reimbursements', 'Reimburse BBM & Tol Kunjungan Vendor', 'Pembayaran Reimburse BBM & Tol'],
    ] as const) {
      if ((await list(finance, `/payments?purpose=${purpose}`)).length) continue
      const target = await byTitle(finance, path, title)
      if (!target) continue
      const amount = Number((await finance.get(`/documents/${target}`)).data.totalAmount)
      const payId = await createDoc(finance, '/payments', { title: payTitle, purpose, targetDocId: target, companyBankAccountId: banks[0].id, paymentMethod: 'TRANSFER', plannedDate: day(1), amountApplied: amount, bankReference: `TRF-${purpose.slice(0, 3)}-2611` })
      await decide(approver, payId)
      await decide(admin, payId)
    }
    if (!(await list(approver, '/reassignments')).length) {
      const mine = (await list(approver, '/approvals/tasks')).filter((t) => t.status === 'PENDING')
      if (mine.length) {
        await approver.post('/reassignments', { fromId: users['approver@purchasing.local'], toId: users['finance@purchasing.local'], approverId: users['admin@purchasing.local'], reason: 'LEAVE', remarks: 'Cuti melahirkan istri 5 hari kerja, mohon dialihkan sementara.', taskIds: [mine[0].id] })
        log(`   + reassignment request (${mine[0].docNo}) waiting for admin`)
      }
    }
  }

  // ---------------------------------------------------------------- 3. transactions
  if (!process.env.FORCE && (await list(buyer, '/pr', SENTINEL_PR)).some((r) => r.title === SENTINEL_PR)) {
    log('3. Transactions already seeded (FORCE=1 to add another set)')
    await collaborate()
    return
  }
  log('3. Transactions')
  const nt30 = (await list(admin, '/payment-terms', 'NET30'))[0].id
  const nt14 = (await list(admin, '/payment-terms', 'NET14'))[0].id
  const line = (code: keyof typeof item, u: keyof typeof uom, c: keyof typeof cat, quantity: number, estimatedUnitPrice: number, description?: string) =>
    ({ itemId: item[code], description: description ?? code, categoryId: cat[c], uomId: uom[u], quantity, estimatedUnitPrice })
  const pr = (title: string, d: string, p: string, c: string, lines: Json[], extra: Json = {}) =>
    ({ title, departmentId: dept[d], purchaseClassId: pc[p], costCenterId: cc[c], requiredDate: day(21), justification: 'Kebutuhan operasional rutin', lines, ...extra })

  // PRs in every state
  const prAtk = await createDoc(buyer, '/pr', pr(SENTINEL_PR, 'PROC', 'GENERAL', 'CC-PROC', [
    line('ATK-KRT-A4', 'RIM', 'ATK', 200, 52000, 'Kertas HVS A4 80gsm'), line('ATK-PLP-HTM', 'BOX', 'ATK', 30, 48000, 'Pulpen Gel Hitam 0.5mm'), line('ATK-MAP-PLS', 'PAK', 'ATK', 40, 35000, 'Map Plastik Snelhecter')]))
  await decide(approver, prAtk)
  const prLaptop = await createDoc(buyer, '/pr', pr('Laptop untuk Tim Finance & IT', 'IT', 'CAPEX', 'CC-IT', [line('IT-LPT-14', 'UNIT', 'IT-HW', 6, 15500000, 'Laptop 14" Core i5 16GB/512GB'), line('IT-MON-24', 'UNIT', 'IT-HW', 6, 2350000, 'Monitor LED 24"')], { sourcingMethod: 'RFQ', justification: 'Penggantian laptop usia > 5 tahun' }))
  await decide(approver, prLaptop)
  await decide(admin, prLaptop)
  const prResin = await createDoc(buyer, '/pr', pr('Bahan Baku Resin PP Desember', 'OPS', 'RAW_MAT', 'CC-OPS', [line('RAW-RSN-PP', 'KG', 'RAW', 5000, 24500, 'Resin PP Homopolymer'), line('RAW-PGM-BLU', 'KG', 'RAW', 150, 98000, 'Pigmen Biru Masterbatch')], { sourcingMethod: 'CONTRACT' }))
  await decide(approver, prResin)
  await decide(admin, prResin)
  await createDoc(buyer, '/pr', pr('Jasa Cleaning Service Gedung 2027', 'GA', 'SERVICE', 'CC-GA', [line('SVC-CLN-MON', 'BLN', 'SVC-CLN', 12, 18500000, 'Jasa Cleaning Service Gedung (bulanan)')]))
  const prChair = await createDoc(buyer, '/pr', pr('Kursi Kerja Ergonomis Lantai 3', 'GA', 'GENERAL', 'CC-GA', [line('FRN-CHR-ERG', 'UNIT', 'FURN', 15, 2750000, 'Kursi Kerja Ergonomis')]))
  await decide(approver, prChair, 'RETURN', 'Mohon lampirkan 2 pembanding harga dan foto kondisi kursi lama.')
  const prHelm = await createDoc(buyer, '/pr', pr('Helm Safety Pengunjung Pabrik', 'OPS', 'GENERAL', 'CC-OPS', [line('SAF-HLM-STD', 'PCS', 'SAFETY', 100, 85000, 'Helm Safety SNI')]))
  await decide(approver, prHelm, 'REJECT', 'Stok helm pengunjung masih 80 pcs di gudang, belum perlu pengadaan.')
  await createDoc(buyer, '/pr', pr('Oli Hidrolik Mesin Injection', 'OPS', 'GENERAL', 'CC-OPS', [line('MRO-OLI-HYD', 'DRUM', 'MRO', 4, 4850000, 'Oli Hidrolik ISO VG 46')]), false)

  // RFQ → quotations from invited vendors → evaluation
  const rfqLaptop = await createDoc(buyer, '/rfq', {
    title: 'RFQ Laptop & Monitor Tim Finance/IT', submissionDeadline: day(10), quoteValidityDays: 30, departmentId: dept.IT,
    vendorIds: [bps['VEND-001'], bps['VEND-002'], bps['VEND-003']].filter(Boolean),
    terms: 'Garansi resmi 3 tahun, termasuk instalasi OS & antivirus.',
    lines: [{ itemId: item['IT-LPT-14'], description: 'Laptop 14" Core i5 16GB/512GB', categoryId: cat['IT-HW'], uomId: uom.UNIT, quantity: 6 }, { itemId: item['IT-MON-24'], description: 'Monitor LED 24"', categoryId: cat['IT-HW'], uomId: uom.UNIT, quantity: 6 }],
  })
  await createDoc(vendor, '/quotations', { title: 'Penawaran Laptop & Monitor - Sumber Makmur', rfqId: rfqLaptop, bpReference: 'SMS/QT/2611/031', validUntil: day(30), paymentTermId: nt30, deliveryTerms: 'Franco Gudang Cikarang, 7 hari kerja', lines: [{ quantity: 6, unitPrice: 15200000, leadTimeDays: 7 }, { quantity: 6, unitPrice: 2290000, discountPercent: 2, leadTimeDays: 7 }] })
  await createDoc(mitra, '/quotations', { title: 'Penawaran Laptop & Monitor - Mitra Jaya', rfqId: rfqLaptop, bpReference: 'MJP-2611-118', validUntil: day(21), paymentTermId: nt14, deliveryTerms: 'Franco Gudang Cikarang, 14 hari kerja', lines: [{ quantity: 6, unitPrice: 14950000, leadTimeDays: 14 }, { quantity: 6, unitPrice: 2400000, leadTimeDays: 14 }] })
  await createDoc(buyer, '/rfq', {
    title: 'RFQ Jasa Konsultan Pajak 2027', submissionDeadline: day(14), departmentId: dept.FIN, vendorIds: [bps['VEND-003'], bps['VEND-004'], bps['VEND-005']].filter(Boolean),
    lines: [{ itemId: item['SVC-CONS-TAX'], description: 'Jasa Konsultan Pajak (retainer)', categoryId: cat['SVC-CONS'], uomId: uom.JAM, quantity: 120 }],
  }, false)

  // contract
  const ctr = await createDoc(buyer, '/contracts', {
    title: 'Kontrak Payung ATK 2027', bpId: bps['VEND-001'], agreementType: 'AMOUNT', startDate: day(7), endDate: day(372), targetAmount: 250000000, purchaseClassId: pc.GENERAL, paymentTermId: nt30, bpReference: 'SMS/KTR/2026/004',
    terms: 'Harga tetap 12 bulan. Pengiriman maksimal 3 hari kerja setelah PO.',
    lines: [{ itemId: item['ATK-KRT-A4'], description: 'Kertas HVS A4 80gsm', uomId: uom.RIM, targetQty: 2400, unitPrice: 51000 }, { itemId: item['ATK-PLP-HTM'], description: 'Pulpen Gel Hitam 0.5mm', uomId: uom.BOX, targetQty: 360, unitPrice: 46500 }],
  })
  await decide(approver, ctr)
  await decide(admin, ctr)

  // purchase orders
  const po = (title: string, bp: string, p: string, lines: Json[], extra: Json = {}) =>
    ({ title, bpId: bps[bp], purchaseClassId: pc[p], paymentTermId: nt30, deliveryDate: day(10), deliveryAddress: 'Gudang Cikarang, Jl. Industri Selatan 5 Blok GG-3, Bekasi', shippingMethod: 'Truck', lines, ...extra })
  const poAtk = await createDoc(buyer, '/po', po('PO ATK Kantor Q4 2026', 'VEND-001', 'GENERAL', [
    { itemId: item['ATK-KRT-A4'], description: 'Kertas HVS A4 80gsm', uomId: uom.RIM, quantity: 200, unitPrice: 51000 },
    { itemId: item['ATK-PLP-HTM'], description: 'Pulpen Gel Hitam 0.5mm', uomId: uom.BOX, quantity: 30, unitPrice: 46500 },
    { itemId: item['ATK-MAP-PLS'], description: 'Map Plastik Snelhecter', uomId: uom.PAK, quantity: 40, unitPrice: 34000 }], { bpReference: 'SMS/QT/2611/020' }))
  await decide(approver, poAtk)
  const poLaptop = await createDoc(buyer, '/po', po('PO Laptop & Monitor Tim Finance/IT', 'VEND-001', 'CAPEX', [
    { itemId: item['IT-LPT-14'], description: 'Laptop 14" Core i5 16GB/512GB', uomId: uom.UNIT, quantity: 6, unitPrice: 15200000 },
    { itemId: item['IT-MON-24'], description: 'Monitor LED 24"', uomId: uom.UNIT, quantity: 6, unitPrice: 2290000, discountPercent: 2 }], { bpReference: 'SMS/QT/2611/031' }))
  await decide(approver, poLaptop)
  await decide(admin, poLaptop)
  const poResin = await createDoc(buyer, '/po', po('PO Resin PP & Pigmen Desember', 'VEND-003', 'RAW_MAT', [
    { itemId: item['RAW-RSN-PP'], description: 'Resin PP Homopolymer', uomId: uom.KG, quantity: 5000, unitPrice: 24200 },
    { itemId: item['RAW-PGM-BLU'], description: 'Pigmen Biru Masterbatch', uomId: uom.KG, quantity: 150, unitPrice: 96500 }], { freightAmount: 1500000 }))
  await decide(approver, poResin)
  await decide(admin, poResin)
  await createDoc(buyer, '/po', po('PO Karton Box Packaging', 'VEND-002', 'RAW_MAT', [{ itemId: item['PCK-CTN-40'], description: 'Karton Box 40x30x30', uomId: uom.PCS, quantity: 3000, unitPrice: 6800 }]))
  await createDoc(buyer, '/po', po('PO Jasa Cleaning Desember', 'VEND-004', 'SERVICE', [{ itemId: item['SVC-CLN-MON'], description: 'Jasa Cleaning Service Gedung - Desember 2026', uomId: uom.BLN, quantity: 1, unitPrice: 18500000 }], { poType: 'SERVICE' }), false)

  // goods receipts (full + partial)
  const poLines = async (id: string) => (await buyer.get(`/po/${id}/lines`)).data as Json[]
  await createDoc(buyer, '/gr', { title: 'Penerimaan ATK Q4', poId: poAtk, receivedDate: day(), deliveryNoteNo: 'SJ-SMS-2611-0451', vehiclePlateNo: 'B 9123 KXT', driverName: 'Slamet', location: 'Gudang Cikarang',
    lines: (await poLines(poAtk)).map((l) => ({ poLineId: l.id, receivedQty: Number(l.quantity), acceptedQty: Number(l.quantity) })) })
  const resinLines = await poLines(poResin)
  await createDoc(buyer, '/gr', { title: 'Penerimaan Resin Tahap 1', poId: poResin, receivedDate: day(), deliveryNoteNo: 'SJ-KTN-1123', vehiclePlateNo: 'B 9876 UYT', driverName: 'Joko', location: 'Gudang Bahan Baku',
    lines: resinLines.map((l, i) => ({ poLineId: l.id, receivedQty: i === 0 ? 3000 : Number(l.quantity), acceptedQty: i === 0 ? 2950 : Number(l.quantity), rejectedQty: i === 0 ? 50 : 0, rejectReason: i === 0 ? '2 sak sobek / basah' : null })) })

  // finance: AP invoice → payment, cash advance → settlement, reimbursement, AR invoice
  const coas = (await finance.get('/coas')).data as Json[]
  const coa = (re: RegExp) => (coas.find((c) => re.test(`${c.code ?? ''} ${c.name ?? ''}`)) ?? coas[0]).id
  const inv = await createDoc(finance, '/ap-invoices', { title: 'Invoice ATK Q4 - Sumber Makmur', bpId: bps['VEND-001'], poId: poAtk, bpInvoiceNo: 'INV/SMS/2611/0778', taxInvoiceNo: '010.000-26.00012345', invoiceDate: day(), dueDate: day(30),
    lines: [{ description: 'Kertas HVS A4 80gsm', quantity: 200, unitPrice: 51000 }, { description: 'Pulpen Gel Hitam 0.5mm', quantity: 30, unitPrice: 46500 }, { description: 'Map Plastik Snelhecter', quantity: 40, unitPrice: 34000 }] })
  await decide(approver, inv)
  await createDoc(finance, '/ap-invoices', { title: 'Invoice DP Laptop - Sumber Makmur', bpId: bps['VEND-001'], poId: poLaptop, invoiceKind: 'DOWN_PAYMENT', bpInvoiceNo: 'INV/SMS/2611/0790', invoiceDate: day(), dueDate: day(14),
    lines: [{ description: 'Down payment 30% PO Laptop & Monitor', quantity: 1, unitPrice: 31500000 }] })
  const banks = (await finance.get('/company-banks')).data as Json[]
  const invTotal = Number((await finance.get(`/documents/${inv}`)).data.totalAmount)
  const pay = await createDoc(finance, '/payments', { title: 'Pembayaran Invoice ATK Q4', purpose: 'AP_INVOICE', targetDocId: inv, companyBankAccountId: banks[0].id, plannedDate: day(2), amountApplied: invTotal, bankReference: 'TRF-BCA-26112601' })
  await decide(approver, pay)
  await decide(admin, pay)

  const txTypes = (await buyer.get('/transaction-types')).data as Json[]
  const ca = await createDoc(buyer, '/cash-advances', { title: 'Kas Bon Kunjungan Vendor Surabaya', departmentId: dept.PROC, transactionTypeId: txTypes[0].id, purpose: 'Audit & kunjungan supplier resin di Surabaya (3 hari)', requiredDate: day(5),
    lines: [{ coaId: coa(/travel|perjalanan|dinas/i), costCenterId: cc['CC-PROC'], description: 'Tiket pesawat PP Jakarta–Surabaya', amount: 2850000 }, { coaId: coa(/travel|perjalanan|dinas/i), costCenterId: cc['CC-PROC'], description: 'Hotel 2 malam', amount: 1700000 }, { coaId: coa(/travel|perjalanan|dinas/i), costCenterId: cc['CC-PROC'], description: 'Uang harian & transport lokal', amount: 1200000 }] })
  await decide(approver, ca)
  await decide(finance, ca)
  await createDoc(buyer, '/settlements', { title: 'Settlement Kas Bon Surabaya', caId: ca, referenceNo: 'STL-SBY-2611',
    lines: [{ coaId: coa(/travel|perjalanan|dinas/i), costCenterId: cc['CC-PROC'], description: 'Tiket pesawat PP (realisasi)', expenseDate: day(-1), amount: 2690000 }, { coaId: coa(/travel|perjalanan|dinas/i), costCenterId: cc['CC-PROC'], description: 'Hotel 2 malam (realisasi)', expenseDate: day(-1), amount: 1700000 }, { coaId: coa(/travel|perjalanan|dinas/i), costCenterId: cc['CC-PROC'], description: 'Transport lokal', expenseDate: day(-1), amount: 960000 }] })
  const rmb = await createDoc(buyer, '/reimbursements', { title: 'Reimburse BBM & Tol Kunjungan Vendor', departmentId: dept.PROC, transactionTypeId: txTypes[txTypes.length > 1 ? 1 : 0].id, referenceNo: 'KWT-0098',
    lines: [{ coaId: coa(/transport|travel|perjalanan/i), costCenterId: cc['CC-PROC'], description: 'BBM Pertamax', expenseDate: day(-3), amount: 450000 }, { coaId: coa(/transport|travel|perjalanan/i), costCenterId: cc['CC-PROC'], description: 'Tol Jakarta–Cikarang PP', expenseDate: day(-3), amount: 96000 }] })
  await decide(approver, rmb)
  await decide(finance, rmb)
  await createDoc(buyer, '/reimbursements', { title: 'Reimburse Konsumsi Rapat Vendor', departmentId: dept.PROC, transactionTypeId: txTypes[0].id,
    lines: [{ coaId: coa(/meal|konsumsi|entertain/i), costCenterId: cc['CC-PROC'], description: 'Makan siang rapat negosiasi', expenseDate: day(-2), amount: 875000 }] }, false)
  const ari = await createDoc(finance, '/ar-invoices', { title: 'Penjualan Scrap Plastik November', bpId: bps['VEND-002'], customerPoNo: 'PO-MJP-7781', invoiceDate: day(), dueDate: day(14),
    lines: [{ description: 'Scrap plastik PP giling', uomId: uom.KG, quantity: 850, unitPrice: 6500 }] })
  await decide(approver, ari)

  // vendor verification + collaboration
  if (bps['VEND-005']) await createDoc(buyer, '/verifications', { bpId: bps['VEND-005'], requestType: 'ONBOARDING', title: 'Onboarding CV Sinar Abadi Elektrik', remarks: 'Calon vendor panel listrik & instalasi.' })
  await buyer.post(`/documents/${poLaptop}/comments`, { body: 'Mohon konfirmasi jadwal pengiriman, kami butuh unit paling lambat tanggal 5.' })
  await vendor.post(`/documents/${poLaptop}/comments`, { body: 'Siap, unit ready stock. Pengiriman H+5 setelah PO diterima.' })

  if (!(await list(approver, '/approvals/delegations')).length)
    await approver.post('/approvals/delegations', { toId: users['admin@purchasing.local'], docType: 'PO', startsAt: new Date(Date.now() + 14 * 86_400_000).toISOString(), endsAt: new Date(Date.now() + 21 * 86_400_000).toISOString(), reason: 'Cuti tahunan' })

  await collaborate()
  log('Done.')
}

main().catch((e) => {
  console.error('\nSEED FAILED:', e.message)
  process.exit(1)
})
