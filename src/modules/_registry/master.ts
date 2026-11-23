import type { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { departmentRoutes } from '../department/department.routes'
import { currencyRoutes } from '../currency/currency.routes'
import { exchangeRateRoutes } from '../exchange-rate/exchange-rate.routes'
import { taxCodeRoutes } from '../tax-code/tax-code.routes'
import { paymentTermRoutes } from '../payment-term/payment-term.routes'
import { uomRoutes } from '../uom/uom.routes'
import { categoryRoutes } from '../category/category.routes'
import { purchaseClassRoutes } from '../purchase-class/purchase-class.routes'
import { itemRoutes } from '../item/item.routes'
import { formNoteRoutes } from '../form-note/form-note.routes'
import { bankRoutes } from '../bank/bank.routes'
import { bpDocumentTypeRoutes } from '../bp-document-type/bp-document-type.routes'
import { budgetRoutes } from '../budget/budget.routes'
import { numberSeriesRoutes } from '../number-series/number-series.routes'

/** Routes owned by the "master" group: [mount path under /api, router]. */
export const routes: [string, Hono<AppEnv, any, any>][] = [
  ['/departments', departmentRoutes],
  ['/currencies', currencyRoutes],
  ['/exchange-rates', exchangeRateRoutes],
  ['/tax-codes', taxCodeRoutes],
  ['/payment-terms', paymentTermRoutes],
  ['/uoms', uomRoutes],
  ['/categories', categoryRoutes],
  ['/purchase-classes', purchaseClassRoutes],
  ['/items', itemRoutes],
  ['/form-notes', formNoteRoutes],
  ['/banks', bankRoutes],
  ['/bp-document-types', bpDocumentTypeRoutes],
  ['/budgets', budgetRoutes],
  ['/number-series', numberSeriesRoutes],
]
