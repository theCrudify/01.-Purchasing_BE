import { crudController } from '../../core/crud'
import { BudgetService } from './budget.service'

/** HTTP in/out only: validated input → service → JSON. */
export const budgetController = crudController((c) => new BudgetService(c.get('db'), c.get('actor')))
