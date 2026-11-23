import { crudRoutes } from '../../core/crud'
import { budgetController } from './budget.controller'
import { budgetCreate, budgetDef } from './budget.schema'

/** Wiring only: auth + INTERNAL + permissions + zod validators (see crudRoutes). */
export const budgetRoutes = crudRoutes(budgetDef, budgetController, { create: budgetCreate }, { view: 'MASTER.VIEW', manage: 'BUDGET.MANAGE', delete: 'MASTER.DELETE' })
