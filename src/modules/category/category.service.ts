import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { conflict } from '../../core/errors'
import { rule } from '../_master/shared'
import { CategoryRepository } from './category.repository'
import { categoryDef } from './category.schema'

export class CategoryService extends CrudService<CategoryRepository> {
  constructor(db: Db, actor: Actor) {
    super(db, actor, (q) => new CategoryRepository(q), categoryDef, {
      async beforeCreate(repo, d) { if (!(await repo.usable('mst_category', d.parentId))) throw rule('Parent category is not active') },
      async beforeUpdate(repo, key, d) {
        const parentId = d.parentId as number | null | undefined
        if (parentId == null) return
        if (parentId === key || (await repo.wouldCycle(key as number, parentId))) throw conflict('Parent would create a cycle')
        if (!(await repo.usable('mst_category', parentId))) throw rule('Parent category is not active')
      },
      async beforeDelete(repo, key) { if (await repo.inUse(key as number)) throw conflict('Category still has sub-categories or items') },
    })
  }
}
