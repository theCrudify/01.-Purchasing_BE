import type { Db } from '../../core/db'
import type { Actor } from '../../core/types'
import { CrudService } from '../../core/crud'
import { notFound } from '../../core/errors'
import { rule } from '../_master/shared'
import { TaxCodeRepository } from './tax-code.repository'
import { taxCodeDef } from './tax-code.schema'

const checkPeriod = (from: string, to?: string | null) => { if (to && to < from) throw rule('Effective to must be on or after effective from') }

export class TaxCodeService extends CrudService<TaxCodeRepository> {
  constructor(db: Db, actor: Actor) {
    super(db, actor, (q) => new TaxCodeRepository(q), taxCodeDef, {
      async beforeCreate(_r, d) { checkPeriod(d.effectiveFrom as string, d.effectiveTo as string | null) },
      async beforeUpdate(repo, key, d) {
        const cur = await repo.period(key as number)
        if (!cur) throw notFound('Tax code')
        checkPeriod((d.effectiveFrom as string) ?? cur.f, d.effectiveTo !== undefined ? (d.effectiveTo as string | null) : cur.t)
      },
    })
  }
}
