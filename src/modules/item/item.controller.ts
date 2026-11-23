import { crudController } from '../../core/crud'
import { ItemService } from './item.service'

/** HTTP in/out only: validated input → service → JSON. */
export const itemController = crudController((c) => new ItemService(c.get('db'), c.get('actor')))
