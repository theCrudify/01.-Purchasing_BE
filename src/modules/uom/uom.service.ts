import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { conflict } from '../../core/errors'
import { UomRepository } from './uom.repository'
import { uomDef } from './uom.schema'

export class UomService extends CrudService<UomRepository> {
  constructor(db: Db, actor: Actor) {
    super(db, actor, (q) => new UomRepository(q), uomDef, {
      async beforeDelete(repo, key) { if (await repo.usedByActiveItem(key as number)) throw conflict('UoM is used by items') },
    })
  }
}
