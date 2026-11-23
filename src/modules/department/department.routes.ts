import { crudRoutes } from '../../core/crud'
import { departmentController } from './department.controller'
import { departmentCreate, departmentDef } from './department.schema'

/** Wiring only: auth + INTERNAL + MASTER.* permissions + zod validators (see crudRoutes). */
export const departmentRoutes = crudRoutes(departmentDef, departmentController, { create: departmentCreate })
