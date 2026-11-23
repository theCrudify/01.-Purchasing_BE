import { z } from 'zod'
import type { CrudDef } from '../../core/crud'

/** Read through the single-table view vw_number_series (synthetic "Key" = SERIES.PERIOD, auto-updatable). */
export const numberSeriesDef: CrudDef = {
  name: 'Number series',
  table: 'vw_number_series',
  key: { col: 'Key', type: 'code' },
  pk: 'Key',
  fields: { key: 'Key', seriesCode: 'SeriesCode', periodKey: 'PeriodKey', prefix: 'Prefix', format: 'Format', lastNumber: 'LastNumber', allowPortal: 'AllowPortal' },
  searchable: ['SeriesCode', 'Prefix'],
  sortable: { seriesCode: 'SeriesCode', periodKey: 'PeriodKey', lastNumber: 'LastNumber' },
  defaultSort: 'seriesCode:asc',
  softDelete: false, hasActive: false, audit: false, hasUpdatedAt: false,
}
// Format must contain the sequence token so numbers stay unique.
export const numberSeriesUpdate = z.object({
  prefix: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9\/.-]+$/).optional(),
  format: z.string().trim().max(50).regex(/\{SEQ(:\d)?\}/, 'format must contain {SEQ} or {SEQ:n}').optional(),
}).strict().refine((v) => Object.keys(v).length > 0, 'Nothing to update')
export const numberSeriesKey = z.object({ key: z.string().regex(/^[A-Z_]{1,20}\.\d{6}$/) })
