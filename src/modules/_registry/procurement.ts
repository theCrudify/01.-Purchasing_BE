import type { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { ctrRoutes, grRoutes, poRoutes, prRoutes, quoRoutes, rfqRoutes } from '../procurement/procurement.routes'
import {
  ariRoutes,
  caRoutes,
  coaLookupRoutes,
  companyBankLookupRoutes,
  invRoutes,
  payRoutes,
  rmbRoutes,
  stlRoutes,
  txTypeLookupRoutes,
} from '../finance/finance.routes'

/** Routes owned by the "procurement" & "finance" groups: [mount path under /api, router]. */
export const routes: [string, Hono<AppEnv, any, any>][] = [
  ['/pr', prRoutes],
  ['/rfq', rfqRoutes],
  ['/quotations', quoRoutes],
  ['/contracts', ctrRoutes],
  ['/po', poRoutes],
  ['/gr', grRoutes],
  ['/cash-advances', caRoutes],
  ['/settlements', stlRoutes],
  ['/reimbursements', rmbRoutes],
  ['/ap-invoices', invRoutes],
  ['/payments', payRoutes],
  ['/ar-invoices', ariRoutes],
  ['/coas', coaLookupRoutes],
  ['/transaction-types', txTypeLookupRoutes],
  ['/company-banks', companyBankLookupRoutes],
]
