import { z } from 'zod'
import { listQuerySchema, type ListConfig } from '../../core/list-query'

export const bpList: ListConfig = {
  table: 'vw_bp_list',
  select: {
    id: 'PublicId',
    bpCode: 'BpCode',
    isSupplier: 'IsSupplier',
    isCustomer: 'IsCustomer',
    entityType: 'EntityType',
    legalName: 'LegalName',
    tradeName: 'TradeName',
    taxId: 'TaxId',
    businessRegNo: 'BusinessRegNo',
    isVatRegistered: 'IsVatRegistered',
    countryCode: 'CountryCode',
    email: 'Email',
    phone: 'Phone',
    defaultCurrencyCode: 'DefaultCurrencyCode',
    paymentTermId: 'PaymentTermId',
    paymentTermName: 'PaymentTermName',
    onboardingStatus: 'OnboardingStatus',
    operationalStatus: 'OperationalStatus',
    createdAt: 'CreatedAt',
  },
  searchable: ['BpCode', 'LegalName', 'TradeName', 'TaxId', 'Email'],
  sortable: {
    bpCode: 'BpCode',
    legalName: 'LegalName',
    onboardingStatus: 'OnboardingStatus',
    operationalStatus: 'OperationalStatus',
    createdAt: 'CreatedAt',
  },
  defaultSort: 'legalName:asc',
  tiebreaker: 'Id',
}

export const bpListQuery = listQuerySchema.extend({
  operationalStatus: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED']).optional(),
  onboardingStatus: z.string().optional(),
})

export const bpCreate = z
  .object({
    bpCode: z.string().trim().min(1).max(20).optional(),
    entityType: z.enum(['COMPANY', 'INDIVIDUAL']).default('COMPANY'),
    legalName: z.string().trim().min(2).max(200),
    tradeName: z.string().trim().max(200).nullable().optional(),
    taxId: z.string().trim().max(20).nullable().optional(),
    businessRegNo: z.string().trim().max(20).nullable().optional(),
    isVatRegistered: z.boolean().default(true),
    isSupplier: z.boolean().default(true),
    isCustomer: z.boolean().default(false),
    email: z.string().trim().email().max(254).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    defaultCurrencyCode: z.string().trim().length(3).default('IDR'),
    paymentTermId: z.number().int().positive().nullable().optional(),
    operationalStatus: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED']).default('ACTIVE'),
  })
  .strict()

export const bpUpdate = bpCreate.partial().strict()
export const uuidParam = z.object({ id: z.string().uuid() })

export const svrList: ListConfig = {
  table: 'vw_doc_svr',
  select: {
    id: 'PublicId',
    docNo: 'DocNo',
    docDate: 'DocDate',
    status: 'Status',
    title: 'Title',
    bpId: 'BpPublicId',
    bpCode: 'BpCode',
    bpName: 'BpName',
    requestType: 'RequestType',
    ownerName: 'OwnerName',
    reviewerName: 'ReviewerName',
    createdAt: 'CreatedAt',
  },
  searchable: ['DocNo', 'Title', 'BpName', 'BpCode', 'OwnerName'],
  sortable: { docDate: 'DocDate', docNo: 'DocNo', status: 'Status', bpName: 'BpName', createdAt: 'CreatedAt' },
  defaultSort: 'createdAt:desc',
  tiebreaker: 'Id',
}

export const svrListQuery = listQuerySchema.extend({
  status: z.string().optional(),
})

export const svrCreate = z
  .object({
    bpId: z.string().uuid(),
    requestType: z.enum(['ONBOARDING', 'REVERIFICATION', 'PROFILE_UPDATE', 'BANK_CHANGE']).default('ONBOARDING'),
    title: z.string().trim().min(2).max(200),
    remarks: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()

export type BpCreate = z.infer<typeof bpCreate>
export type BpUpdate = z.infer<typeof bpUpdate>
export type SvrCreate = z.infer<typeof svrCreate>
