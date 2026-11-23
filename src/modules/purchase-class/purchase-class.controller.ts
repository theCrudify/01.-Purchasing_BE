import { crudController } from '../../core/crud'
import { PurchaseClassService } from './purchase-class.service'

/** HTTP in/out only: validated input → service → JSON. */
export const purchaseClassController = crudController((c) => new PurchaseClassService(c.get('db'), c.get('actor')))
