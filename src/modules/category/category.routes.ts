import { crudRoutes } from '../../core/crud'
import { categoryController } from './category.controller'
import { categoryCreate, categoryDef } from './category.schema'

/** Wiring only: auth + INTERNAL + permissions + zod validators (see crudRoutes). */
export const categoryRoutes = crudRoutes(categoryDef, categoryController, { create: categoryCreate })
