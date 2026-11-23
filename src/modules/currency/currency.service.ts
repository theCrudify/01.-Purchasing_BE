import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { rule } from '../_master/shared'
import { CurrencyRepository } from './currency.repository'
import { currencyDef } from './currency.schema'

export class CurrencyService extends CrudService<CurrencyRepository> {
  constructor(db: Db, actor: Actor) {
    super(db, actor, (q) => new CurrencyRepository(q), currencyDef, {
      async beforeUpdate(repo, key, d) {
        if (key === 'IDR' && d.isActive === false) throw rule('IDR is the base currency and cannot be deactivated')
        if (d.isActive === false && (await repo.usedByOpenDocuments(key as string))) throw rule('Currency is used by open documents')
      },
    })
  }
}
