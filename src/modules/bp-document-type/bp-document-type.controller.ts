import { crudController } from '../../core/crud'
import { BpDocumentTypeService } from './bp-document-type.service'

/** HTTP in/out only: validated input → service → JSON. */
export const bpDocumentTypeController = crudController((c) => new BpDocumentTypeService(c.get('db'), c.get('actor')))
