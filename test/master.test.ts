import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DB_URL, client, ensureUser, sql } from './helpers'

const PW = 'Secret-pass-123'
const uniq = Date.now().toString(36).toUpperCase()

describe.skipIf(!DB_URL)('master data (real Postgres)', () => {
  const a = client()
  beforeAll(async () => {
    await ensureUser('m-admin@test.local', PW, 'ALL')
    await ensureUser('m-viewer@test.local', PW, ['MASTER.VIEW'])
    await sql(`INSERT INTO mst_currency ("Code","NumericCode","Name","Decimals","IsActive") VALUES ('IDR','360','Rupiah',2,true),('USD','840','US Dollar',2,true),('JPY','392','Yen',0,true),('EUR','978','Euro',2,false)
               ON CONFLICT ("Code") DO NOTHING`)
    await sql(`UPDATE mst_currency SET "IsActive"=true WHERE "Code" IN ('IDR','USD','JPY')`)
    expect((await a.login('m-admin@test.local', PW)).status).toBe(200)
  })
  afterEach(() => vi.restoreAllMocks())

  it('simple masters: create, search, sort, validate, soft delete', async () => {
    const cases: [string, Record<string, unknown>, Record<string, unknown>][] = [
      ['/uoms', { code: `U${uniq}`, name: 'Piece' }, { code: 'bad code!', name: 'x' }],
      ['/payment-terms', { code: `N30${uniq}`, name: 'Net 30', dueDays: 30 }, { code: 'X', name: 'x', dueDays: -1 }],
      ['/tax-codes', { code: `V${uniq}`, name: 'PPN 11%', taxType: 'VAT', ratePercent: '11', effectiveFrom: '2025-01-01' }, { code: 'X', name: 'x', taxType: 'VAT', ratePercent: '101', effectiveFrom: '2025-01-01' }],
      ['/purchase-classes', { code: `PC${uniq}`, name: 'Goods', invoicePriceTolerancePct: '0' }, { code: 'X', name: 'x', invoicePriceTolerancePct: 'abc' }],
      ['/banks', { code: `B${uniq}`, name: 'Bank Test', swiftCode: 'BKTEIDJA' }, { code: 'X', name: 'x', swiftCode: '123' }],
      ['/bp-document-types', { code: `NPWP${uniq}`, name: 'NPWP', isMandatory: true }, { code: 'X', name: 'x', appliesTo: 'NOPE' }],
    ]
    for (const [path, good, bad] of cases) {
      const r = await a.post(path, good)
      expect(r.status, `${path} create ${JSON.stringify(r.json)}`).toBe(201)
      expect((await a.post(path, good)).status, `${path} duplicate`).toBe(409)
      expect((await a.post(path, bad)).status, `${path} invalid`).toBe(422)
      expect((await a.post(path, { ...good, hacker: 1 })).status, `${path} unknown field`).toBe(422)
      const list = await a.get(`${path}?q=${uniq.toLowerCase()}&sort=code:desc&pageSize=5`)
      expect(list.status).toBe(200)
      expect(list.json.meta.total).toBeGreaterThanOrEqual(1)
      const id = r.json.data.id
      expect((await a.del(`${path}/${id}`)).status, `${path} delete`).toBe(200)
      expect((await a.get(`${path}?q=${uniq.toLowerCase()}`)).json.data.find((x: any) => x.id === id)).toBeUndefined()
      expect((await a.post(`${path}/${id}/restore`)).status).toBe(200)
    }
  })

  it('category tree + item rules (active FKs, pack size)', async () => {
    const uom = (await a.post('/uoms', { code: `I${uniq}`, name: 'Box' })).json.data
    const uom2 = (await a.post('/uoms', { code: `J${uniq}`, name: 'Carton' })).json.data
    const cat = (await a.post('/categories', { code: `C${uniq}`, name: 'Office' })).json.data
    const sub = (await a.post('/categories', { code: `C${uniq}-1`, name: 'Paper', parentId: cat.id }))
    expect(sub.status).toBe(201)
    const item = { code: `IT${uniq}`, name: 'A4 Paper', itemType: 'GOODS', categoryId: sub.json.data.id, uomId: uom.id }
    const r = await a.post('/items', item)
    expect(r.status, JSON.stringify(r.json)).toBe(201)
    expect(r.json.data.categoryName).toBe('Paper') // view-backed display names
    expect((await a.post('/items', { ...item, code: `IT${uniq}2`, purchaseUomId: uom2.id })).status).toBe(422) // pack size required
    expect((await a.post('/items', { ...item, code: `IT${uniq}3`, purchaseUomId: uom2.id, packSize: '12' })).status).toBe(201)
    expect((await a.del(`/uoms/${uom2.id}`)).status).toBe(409) // still used by an item
    const uom3 = (await a.post('/uoms', { code: `K${uniq}`, name: 'Unused' })).json.data
    expect((await a.del(`/uoms/${uom3.id}`)).status).toBe(200)
    expect((await a.post('/items', { ...item, code: `IT${uniq}4`, uomId: uom3.id })).status).toBe(422) // inactive UoM
    expect((await a.get(`/items?categoryId=${sub.json.data.id}&sort=name:asc`)).json.meta.total).toBe(2)
  })

  it('budget: one active per year × department × class', async () => {
    const dept = (await a.post('/departments', { code: `BD${uniq}`, name: 'Budget Dept' })).json.data
    const b = { fiscalYear: 2026, departmentId: dept.id, amount: '1000000.00', controlMode: 'BLOCK' }
    expect((await a.post('/budgets', b)).status).toBe(201)
    expect((await a.post('/budgets', b)).status).toBe(409)
    expect((await a.post('/budgets', { ...b, amount: '1.234' })).status).toBe(422)
    const list = await a.get(`/budgets?q=&departmentId=${dept.id}`)
    expect(list.status).toBe(200)
  })

  it('currency + exchange rate + Frankfurter import', async () => {
    expect((await a.patch('/currencies/IDR', { isActive: false })).status).toBe(422)
    expect((await a.get('/currencies?q=dollar&pageSize=50')).json.data.map((x: any) => x.code)).toContain('USD')
    expect((await a.post('/exchange-rates', { currencyCode: 'EUR', rateType: 'MIDDLE', rateDate: '2026-11-20', rateToBase: '17000' })).status).toBe(422) // inactive
    const r = await a.post('/exchange-rates', { currencyCode: 'USD', rateType: 'MIDDLE', rateDate: '2026-11-20', rateToBase: '15800.5' })
    expect(r.status, JSON.stringify(r.json)).toBe(201)
    expect(r.json.data.key).toBe('USD.MIDDLE.2026-11-20')

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ date: '2026-11-21', rates: { USD: 0.0000632, JPY: 0.0097 } })))
    const imp = await a.post('/exchange-rates/import')
    expect(imp.status, JSON.stringify(imp.json)).toBe(200)
    expect(imp.json.data.inserted + imp.json.data.updated).toBe(2)
    const usd = await a.get('/exchange-rates/USD.MIDDLE.2026-11-21')
    expect(Number(usd.json.data.rateToBase)).toBeCloseTo(15822.78, 1)
    expect((await a.get('/exchange-rates?currencyCode=USD&from=2026-11-01&sort=rateDate:desc')).json.data[0].rateDate).toBeTruthy()
    expect((await a.post('/exchange-rates/cron/import')).status).toBe(401) // no cron secret
    expect((await a.del('/exchange-rates/USD.MIDDLE.2026-11-20')).status).toBe(200)
  })

  it('number series: edit prefix/format only, format needs {SEQ}', async () => {
    await sql(`INSERT INTO sys_number_series ("SeriesCode","PeriodKey","Prefix") VALUES ('TST','000000','TST') ON CONFLICT DO NOTHING`)
    expect((await a.patch('/number-series/TST.000000', { format: '{PREFIX}/{YY}' })).status).toBe(422)
    const r = await a.patch('/number-series/TST.000000', { prefix: 'PRQ', format: '{PREFIX}/{SEQ:4}/{MM}{YY}' })
    expect(r.status, JSON.stringify(r.json)).toBe(200)
    expect((await a.patch('/number-series/TST.000000', { lastNumber: 0 })).status).toBe(422) // counter is not editable
  })

  it('viewer can read but not write', async () => {
    const v = client()
    await v.login('m-viewer@test.local', PW)
    expect((await v.get('/uoms')).status).toBe(200)
    expect((await v.post('/uoms', { code: 'NOPE', name: 'x' })).status).toBe(403)
    expect((await v.get('/number-series')).status).toBe(403)
  })
})
