import { z } from 'zod'
import type { CrudDef } from '../../core/crud'
import type { ViewDef } from '../_master/shared'

export const formNoteDef: CrudDef = {
  name: 'Form note',
  table: 'mst_form_note',
  key: { col: 'Id', type: 'int' },
  fields: { id: 'Id', userId: 'UserId', docType: 'DocType', body: 'Body', isActive: 'IsActive', isDeleted: 'IsDeleted', updatedAt: 'UpdatedAt' },
  searchable: ['DocType', 'Body'],
  sortable: { docType: 'DocType', updatedAt: 'UpdatedAt', isActive: 'IsActive' },
  defaultSort: 'docType:asc',
  softDelete: true,
  filters: { docType: 'DocType' },
}
export const formNoteView: ViewDef = { table: 'vw_form_note', fields: { userId: 'UserPublicId', userName: 'UserName' }, sortable: { userName: 'UserName' } }

export const FORM_NOTE_DOC_TYPES = ['PR', 'RFQ', 'CTR', 'PO'] as const
export const formNoteCreate = z.object({
  userId: z.string().uuid().nullable().optional(), // user PublicId; NULL = shown to everyone
  docType: z.enum(FORM_NOTE_DOC_TYPES),
  body: z.string().trim().min(1).max(4000),
  isActive: z.boolean().optional(),
})
export const userLookupQuery = z.object({ q: z.string().trim().max(100).optional() })
