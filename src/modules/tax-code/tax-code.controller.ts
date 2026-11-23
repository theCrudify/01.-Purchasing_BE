import { crudController } from '../../core/crud'
import { TaxCodeService } from './tax-code.service'

/** HTTP in/out only: validated input → service → JSON. */
export const taxCodeController = crudController((c) => new TaxCodeService(c.get('db'), c.get('actor')))
