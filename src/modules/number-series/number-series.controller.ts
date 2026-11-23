import { crudController } from '../../core/crud'
import { NumberSeriesService } from './number-series.service'

export const numberSeriesController = crudController((c) => new NumberSeriesService(c.get('db'), c.get('actor')))
