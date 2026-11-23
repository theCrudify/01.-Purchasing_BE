import { crudRoutes } from '../../core/crud'
import { bpDocumentTypeController } from './bp-document-type.controller'
import { bpDocumentTypeCreate, bpDocumentTypeDef } from './bp-document-type.schema'

/** Wiring only: auth + INTERNAL + permissions + zod validators (see crudRoutes). */
export const bpDocumentTypeRoutes = crudRoutes(bpDocumentTypeDef, bpDocumentTypeController, { create: bpDocumentTypeCreate })
