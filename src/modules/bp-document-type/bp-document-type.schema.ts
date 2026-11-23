import { z } from 'zod'
import type { CrudDef } from '../../core/crud'
import { code, text } from '../_master/shared'

export const bpDocumentTypeDef: CrudDef = {
  name: 'BP document type',
  table: 'mst_bp_document_type',
  key: { col: 'Id', type: 'int' },
  fields: { id: 'Id', code: 'Code', name: 'Name', appliesTo: 'AppliesTo', isMandatory: 'IsMandatory', hasExpiry: 'HasExpiry', allowMultiple: 'AllowMultiple', isActive: 'IsActive', isDeleted: 'IsDeleted' },
  searchable: ['Code', 'Name'],
  sortable: { code: 'Code', name: 'Name', appliesTo: 'AppliesTo', isMandatory: 'IsMandatory', isActive: 'IsActive' },
  defaultSort: 'code:asc',
  softDelete: true,
  audit: false,
  hasUpdatedAt: false,
  filters: { appliesTo: 'AppliesTo' },
}

export const bpDocumentTypeCreate = z.object({
  code: code(30),
  name: text(150),
  appliesTo: z.enum(['ALL', 'COMPANY', 'INDIVIDUAL']).optional(),
  isMandatory: z.boolean().optional(),
  hasExpiry: z.boolean().optional(),
  allowMultiple: z.boolean().optional(),
  isActive: z.boolean().optional(),
})
