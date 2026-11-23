import { crudController } from '../../core/crud'
import { UomService } from './uom.service'

/** HTTP in/out only: validated input → service → JSON. */
export const uomController = crudController((c) => new UomService(c.get('db'), c.get('actor')))
