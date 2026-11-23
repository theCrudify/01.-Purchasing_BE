import { crudController } from '../../core/crud'
import { PaymentTermService } from './payment-term.service'

/** HTTP in/out only: validated input → service → JSON. */
export const paymentTermController = crudController((c) => new PaymentTermService(c.get('db'), c.get('actor')))
