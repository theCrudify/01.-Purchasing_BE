import { crudRoutes } from '../../core/crud'
import { costCenterController } from './cost-center.controller'
import { costCenterCreate, costCenterDef } from './cost-center.schema'

export const costCenterRoutes = crudRoutes(costCenterDef, costCenterController, { create: costCenterCreate })
