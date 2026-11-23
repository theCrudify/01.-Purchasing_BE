import { crudController } from '../../core/crud'
import { DepartmentService } from './department.service'

/** HTTP in/out only: validated input → service → JSON. */
export const departmentController = crudController((c) => new DepartmentService(c.get('db'), c.get('actor')))
