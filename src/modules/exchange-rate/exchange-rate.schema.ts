import { z } from 'zod'
import { listQuerySchema, type ListConfig } from '../../core/list-query'
import { ccy, dec, isoDate } from '../_master/shared'

export const RATE_TYPES = ['MIDDLE', 'TAX', 'BANK'] as const

export const rateList: ListConfig = {
  table: 'vw_exchange_rate',
  select: { key: 'Key', currencyCode: 'CurrencyCode', currencyName: 'CurrencyName', rateType: 'RateType', rateDate: 'RateDate', rateToBase: 'RateToBase', source: 'Source', createdAt: 'CreatedAt' },
  searchable: ['CurrencyCode', 'CurrencyName'],
  sortable: { rateDate: 'RateDate', currencyCode: 'CurrencyCode', rateType: 'RateType' },
  defaultSort: 'rateDate:desc',
  tiebreaker: 'Key',
}
export const rateListQuery = listQuerySchema.extend({
  currencyCode: ccy.optional(), rateType: z.enum(RATE_TYPES).optional(), from: isoDate.optional(), to: isoDate.optional(),
})
export const rateCreate = z.object({
  currencyCode: ccy, rateType: z.enum(RATE_TYPES), rateDate: isoDate,
  rateToBase: dec(12, 6, { gt: 0 }), // IDR per 1 unit (convert "per 100 JPY" quotes before entry)
}).strict()
/** key = CCY.TYPE.YYYY-MM-DD */
export const rateKey = z.object({ key: z.string().regex(/^[A-Z]{3}\.(MIDDLE|TAX|BANK)\.\d{4}-\d{2}-\d{2}$/) })
export const parseKey = (k: string) => { const [currencyCode, rateType, rateDate] = k.split('.'); return { currencyCode: currencyCode!, rateType: rateType!, rateDate: rateDate! } }
export type RateCreate = z.infer<typeof rateCreate>
export type RateListQuery = z.infer<typeof rateListQuery>
