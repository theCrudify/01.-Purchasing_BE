import { crudRoutes } from '../../core/crud'
import { bankController } from './bank.controller'
import { bankCreate, bankDef } from './bank.schema'

/** Wiring only: auth + INTERNAL + permissions + zod validators (see crudRoutes). */
export const bankRoutes = crudRoutes(bankDef, bankController, { create: bankCreate })
