import { crudController } from '../../core/crud'
import { CategoryService } from './category.service'

/** HTTP in/out only: validated input → service → JSON. */
export const categoryController = crudController((c) => new CategoryService(c.get('db'), c.get('actor')))
