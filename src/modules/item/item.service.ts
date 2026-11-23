import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { merged, rule } from '../_master/shared'
import { ItemRepository } from './item.repository'
import { itemDef } from './item.schema'

type ItemData = { categoryId?: number; uomId?: number; purchaseUomId?: number | null; packSize?: string | null; vatTaxCodeId?: number | null }

async function check(repo: ItemRepository, d: ItemData, changed: Record<string, unknown>) {
  if ('categoryId' in changed && !(await repo.usable('mst_category', d.categoryId))) throw rule('Category is not active')
  if ('uomId' in changed && !(await repo.usable('mst_uom', d.uomId))) throw rule('UoM is not active')
  if ('purchaseUomId' in changed && !(await repo.usable('mst_uom', d.purchaseUomId))) throw rule('Purchase UoM is not active')
  if ('vatTaxCodeId' in changed && !(await repo.usable('mst_tax_code', d.vatTaxCodeId, `AND "TaxType"='VAT'`))) throw rule('VAT tax code must be an active VAT code')
  // a different purchase unit needs a conversion factor
  if (d.purchaseUomId != null && d.purchaseUomId !== d.uomId && d.packSize == null) throw rule('Pack size is required when the purchase UoM differs from the inventory UoM')
}

export class ItemService extends CrudService<ItemRepository> {
  constructor(db: Db, actor: Actor) {
    super(db, actor, (q) => new ItemRepository(q), itemDef, {
      beforeCreate: (repo, d) => check(repo, d as ItemData, d),
      beforeUpdate: async (repo, key, d) => check(repo, await merged<ItemData>(repo, key, d), d),
    })
  }
}
