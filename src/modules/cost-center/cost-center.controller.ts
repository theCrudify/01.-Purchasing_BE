import { crudController } from '../../core/crud'
import { CostCenterService } from './cost-center.service'

export const costCenterController = crudController((c) => new CostCenterService(c.get('db'), c.get('actor')))
