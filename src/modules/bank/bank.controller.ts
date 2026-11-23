import { crudController } from '../../core/crud'
import { BankService } from './bank.service'

/** HTTP in/out only: validated input → service → JSON. */
export const bankController = crudController((c) => new BankService(c.get('db'), c.get('actor')))
