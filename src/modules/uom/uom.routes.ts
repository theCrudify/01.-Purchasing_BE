import { crudRoutes } from '../../core/crud'
import { uomController } from './uom.controller'
import { uomCreate, uomDef } from './uom.schema'

/** Wiring only: auth + INTERNAL + permissions + zod validators (see crudRoutes). */
export const uomRoutes = crudRoutes(uomDef, uomController, { create: uomCreate })
