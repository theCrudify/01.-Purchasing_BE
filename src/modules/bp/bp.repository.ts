import type { Queryable } from '../../core/db'
import { runList, type ListQuery } from '../../core/list-query'
import { bpList, svrList, type BpCreate, type BpUpdate } from './bp.schema'

export class BpRepository {
  constructor(private q: Queryable) {}

  list(qs: ListQuery & { operationalStatus?: string; onboardingStatus?: string }) {
    const conds = [`NOT "IsDeleted"`]
    const params: unknown[] = []
    if (qs.operationalStatus) {
      params.push(qs.operationalStatus)
      conds.push(`"OperationalStatus"=$${params.length}`)
    }
    if (qs.onboardingStatus) {
      params.push(qs.onboardingStatus)
      conds.push(`"OnboardingStatus"=$${params.length}`)
    }
    return runList(this.q, bpList, qs, { where: conds, params })
  }

  async byPublicId(publicId: string) {
    const bp = (
      await this.q.query<{
        id: number
        publicId: string
        bpCode: string | null
        entityType: string
        legalName: string
        tradeName: string | null
        taxId: string | null
        businessRegNo: string | null
        isVatRegistered: boolean
        isSupplier: boolean
        isCustomer: boolean
        email: string | null
        phone: string | null
        defaultCurrencyCode: string
        paymentTermId: number | null
        onboardingStatus: string
        operationalStatus: string
      }>(
        `SELECT "Id" AS id, "PublicId" AS "publicId", "BpCode" AS "bpCode", "EntityType" AS "entityType",
                "LegalName" AS "legalName", "TradeName" AS "tradeName", "TaxId" AS "taxId",
                "BusinessRegNo" AS "businessRegNo", "IsVatRegistered" AS "isVatRegistered",
                "IsSupplier" AS "isSupplier", "IsCustomer" AS "isCustomer", "Email" AS email, "Phone" AS phone,
                "DefaultCurrencyCode" AS "defaultCurrencyCode", "PaymentTermId" AS "paymentTermId",
                "OnboardingStatus" AS "onboardingStatus", "OperationalStatus" AS "operationalStatus"
           FROM mst_business_partner WHERE "PublicId"=$1 AND NOT "IsDeleted"`,
        [publicId]
      )
    )[0]
    if (!bp) return undefined

    const addresses = await this.q.query(
      `SELECT "PublicId" AS id, "AddressType" AS "addressType", "Line1" AS line1, "Line2" AS line2,
              "City" AS city, "Province" AS province, "PostalCode" AS "postalCode", "CountryCode" AS "countryCode",
              "IsPrimary" AS "isPrimary"
         FROM mst_bp_address WHERE "BpId"=$1 AND NOT "IsDeleted" ORDER BY "IsPrimary" DESC, "Id"`,
      [bp.id]
    )

    const contacts = await this.q.query(
      `SELECT "PublicId" AS id, "Name" AS name, "Position" AS position, "Email" AS email, "Phone" AS phone,
              "IsPrimary" AS "isPrimary"
         FROM mst_bp_contact WHERE "BpId"=$1 AND NOT "IsDeleted" ORDER BY "IsPrimary" DESC, "Id"`,
      [bp.id]
    )

    const bankAccounts = await this.q.query(
      `SELECT ba."PublicId" AS id, ba."BankId" AS "bankId", b."Code" AS "bankCode", b."Name" AS "bankName",
              b."SwiftCode" AS "swiftCode", ba."AccountNo" AS "accountNo", ba."AccountHolderName" AS "accountHolderName",
              ba."BranchName" AS "branchName", ba."CurrencyCode" AS "currencyCode", ba."Iban" AS iban,
              ba."BeneficiaryCountry" AS "beneficiaryCountry", ba."BeneficiaryCity" AS "beneficiaryCity",
              ba."BeneficiaryAddress" AS "beneficiaryAddress", ba."BankAddress" AS "bankAddress",
              ba."Citizenship" AS citizenship, ba."VerificationStatus" AS "verificationStatus", ba."IsPrimary" AS "isPrimary"
         FROM mst_bp_bank_account ba
         JOIN mst_bank b ON b."Id" = ba."BankId"
        WHERE ba."BpId"=$1 AND NOT ba."IsDeleted" ORDER BY ba."IsPrimary" DESC, ba."Id"`,
      [bp.id]
    )

    return { ...bp, addresses, contacts, bankAccounts }
  }

  async syncSubRecords(bpId: number, d: Partial<BpCreate>, actorId: number) {
    if (d.addresses) {
      await this.q.query(`DELETE FROM mst_bp_address WHERE "BpId"=$1`, [bpId])
      for (const a of d.addresses) {
        if (!a.line1 || !a.city) continue
        await this.q.query(
          `INSERT INTO mst_bp_address ("BpId","AddressType","Line1","Line2","City","Province","PostalCode","CountryCode","IsPrimary","CreatedBy","UpdatedBy")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
          [bpId, a.addressType, a.line1, a.line2 ?? null, a.city, a.province ?? null, a.postalCode ?? null, a.countryCode ?? 'ID', a.isPrimary, actorId]
        )
      }
    }
    if (d.contacts) {
      await this.q.query(`DELETE FROM mst_bp_contact WHERE "BpId"=$1`, [bpId])
      for (const c of d.contacts) {
        if (!c.name) continue
        await this.q.query(
          `INSERT INTO mst_bp_contact ("BpId","Name","Position","Email","Phone","IsPrimary","CreatedBy","UpdatedBy")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
          [bpId, c.name, c.position ?? null, c.email ?? null, c.phone ?? null, c.isPrimary, actorId]
        )
      }
    }
    if (d.bankAccounts) {
      await this.q.query(`DELETE FROM mst_bp_bank_account WHERE "BpId"=$1`, [bpId])
      for (const b of d.bankAccounts) {
        if (!b.accountNo || !b.accountHolderName) continue
        await this.q.query(
          `INSERT INTO mst_bp_bank_account
            ("BpId","BankId","AccountNo","AccountHolderName","BranchName","CurrencyCode","Iban","BeneficiaryCountry","BeneficiaryCity","BeneficiaryAddress","BankAddress","Citizenship","VerificationStatus","IsPrimary","CreatedBy","UpdatedBy")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)`,
          [
            bpId,
            b.bankId || 1,
            b.accountNo,
            b.accountHolderName,
            b.branchName ?? null,
            b.currencyCode || 'IDR',
            b.iban ?? null,
            b.beneficiaryCountry || 'ID',
            b.beneficiaryCity ?? null,
            b.beneficiaryAddress ?? null,
            b.bankAddress ?? null,
            b.citizenship || 'RESIDENT',
            b.verificationStatus || 'VERIFIED',
            b.isPrimary,
            actorId,
          ]
        )
      }
    }
  }

  async create(d: BpCreate, actorId: number) {
    const code = d.bpCode || `VND-${Date.now().toString(36).toUpperCase().slice(-5)}`
    const r = await this.q.query<{ id: number; publicId: string }>(
      `INSERT INTO mst_business_partner
        ("BpCode","EntityType","LegalName","TradeName","TaxId","BusinessRegNo","IsVatRegistered","IsSupplier","IsCustomer",
         "Email","Phone","DefaultCurrencyCode","PaymentTermId","OnboardingStatus","OperationalStatus","Source","CreatedBy","UpdatedBy")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'APPROVED',$14,'INTERNAL',$15,$15)
       RETURNING "Id" AS id, "PublicId" AS "publicId"`,
      [
        code,
        d.entityType,
        d.legalName,
        d.tradeName ?? null,
        d.taxId ?? null,
        d.businessRegNo ?? null,
        d.isVatRegistered,
        d.isSupplier,
        d.isCustomer,
        d.email ?? null,
        d.phone ?? null,
        d.defaultCurrencyCode,
        d.paymentTermId ?? null,
        d.operationalStatus,
        actorId,
      ]
    )
    await this.syncSubRecords(r[0]!.id, d, actorId)
    return this.byPublicId(r[0]!.publicId)
  }

  async update(id: number, publicId: string, d: BpUpdate, actorId: number) {
    await this.q.query(
      `UPDATE mst_business_partner
          SET "LegalName"=COALESCE($2,"LegalName"),
              "TradeName"=COALESCE($3,"TradeName"),
              "TaxId"=COALESCE($4,"TaxId"),
              "BusinessRegNo"=COALESCE($5,"BusinessRegNo"),
              "Email"=COALESCE($6,"Email"),
              "Phone"=COALESCE($7,"Phone"),
              "DefaultCurrencyCode"=COALESCE($8,"DefaultCurrencyCode"),
              "PaymentTermId"=COALESCE($9,"PaymentTermId"),
              "OperationalStatus"=COALESCE($10,"OperationalStatus"),
              "UpdatedBy"=$11,
              "Version"="Version"+1
        WHERE "Id"=$1`,
      [
        id,
        d.legalName ?? null,
        d.tradeName ?? null,
        d.taxId ?? null,
        d.businessRegNo ?? null,
        d.email ?? null,
        d.phone ?? null,
        d.defaultCurrencyCode ?? null,
        d.paymentTermId ?? null,
        d.operationalStatus ?? null,
        actorId,
      ]
    )
    await this.syncSubRecords(id, d, actorId)
    return this.byPublicId(publicId)
  }

  listSvr(qs: ListQuery & { status?: string }) {
    const conds = [`NOT "IsDeleted"`]
    const params: unknown[] = []
    if (qs.status) {
      params.push(qs.status)
      conds.push(`"Status"=$${params.length}`)
    }
    return runList(this.q, svrList, qs, { where: conds, params })
  }

  async insertSvr(docId: number, requestType: string) {
    await this.q.query(`INSERT INTO tr_bp_verification ("DocumentId","RequestType") VALUES ($1,$2)`, [docId, requestType])
  }

  async getSvr(docId: number) {
    return (
      await this.q.query(
        `SELECT "PublicId" AS id, "DocNo" AS "docNo", "DocDate" AS "docDate", "Status" AS status, "Title" AS title,
                "BpPublicId" AS "bpId", "BpCode" AS "bpCode", "BpName" AS "bpName", "RequestType" AS "requestType",
                "OwnerName" AS "ownerName", "Remarks" AS remarks
           FROM vw_doc_svr WHERE "Id"=$1`,
        [docId]
      )
    )[0]
  }
}
