import { crudRoutes } from '../../core/crud'
import { itemController } from './item.controller'
import { itemCreate, itemDef } from './item.schema'

/** Wiring only: auth + INTERNAL + permissions + zod validators (see crudRoutes). */
export const itemRoutes = crudRoutes(itemDef, itemController, { create: itemCreate })
