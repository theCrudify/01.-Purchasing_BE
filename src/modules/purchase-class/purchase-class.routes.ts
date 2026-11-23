import { crudRoutes } from '../../core/crud'
import { purchaseClassController } from './purchase-class.controller'
import { purchaseClassCreate, purchaseClassDef } from './purchase-class.schema'

/** Wiring only: auth + INTERNAL + permissions + zod validators (see crudRoutes). */
export const purchaseClassRoutes = crudRoutes(purchaseClassDef, purchaseClassController, { create: purchaseClassCreate })
