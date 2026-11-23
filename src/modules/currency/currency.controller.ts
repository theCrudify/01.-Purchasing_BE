import { crudController } from '../../core/crud'
import { CurrencyService } from './currency.service'

export const currencyController = crudController((c) => new CurrencyService(c.get('db'), c.get('actor')))
