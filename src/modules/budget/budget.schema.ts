import { z } from 'zod'
import type { CrudDef } from '../../core/crud'
import { dec, id, optId, optText, type ViewDef } from '../_master/shared'

export const budgetDef: CrudDef = {
  name: 'Budget',
  table: 'mst_budget',
  key: { col: 'Id', type: 'int' },
  fields: {
    id: 'Id', fiscalYear: 'FiscalYear', departmentId: 'DepartmentId', purchaseClassId: 'PurchaseClassId', amount: 'Amount', controlMode: 'ControlMode',
    remarks: 'Remarks', isActive: 'IsActive', isDeleted: 'IsDeleted', updatedAt: 'UpdatedAt',
  },
  searchable: ['Remarks'],
  sortable: { fiscalYear: 'FiscalYear', amount: 'Amount', controlMode: 'ControlMode', isActive: 'IsActive', updatedAt: 'UpdatedAt' },
  defaultSort: 'fiscalYear:desc',
  softDelete: true,
  filters: { fiscalYear: 'FiscalYear', departmentId: 'DepartmentId', purchaseClassId: 'PurchaseClassId', controlMode: 'ControlMode' },
}
export const budgetView: ViewDef = {
  table: 'vw_budget',
  fields: { departmentCode: 'DepartmentCode', departmentName: 'DepartmentName', purchaseClassName: 'PurchaseClassName' },
  searchable: ['DepartmentCode', 'DepartmentName', 'PurchaseClassName', 'Remarks'],
  sortable: { departmentCode: 'DepartmentCode', departmentName: 'DepartmentName', purchaseClassName: 'PurchaseClassName' },
}

/** Yearly IDR budget per department (× purchase class; NULL = whole department). BLOCK rejects PR/PO submit over budget, WARN reports. */
export const budgetCreate = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  departmentId: id,
  purchaseClassId: optId,
  amount: dec(17, 2, { min: 0 }),
  controlMode: z.enum(['BLOCK', 'WARN']).optional(),
  remarks: optText(300),
  isActive: z.boolean().optional(),
})
