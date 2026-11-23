import type { Context } from 'hono'
import type { AppEnv } from '../../env'
import { EmployeeService } from './employee.service'
import type { EmployeeCreate, EmployeeListQuery, EmployeeUpdate } from './employee.schema'

const svc = (c: Context<AppEnv>) => new EmployeeService(c.get('db'), c.get('actor'))
export const employeeController = {
  list: async (c: Context<AppEnv>, qs: EmployeeListQuery) => c.json(await svc(c).list(qs)),
  get: async (c: Context<AppEnv>, id: string) => c.json({ data: await svc(c).get(id) }),
  create: async (c: Context<AppEnv>, d: EmployeeCreate) => c.json({ data: await svc(c).create(d) }, 201),
  update: async (c: Context<AppEnv>, id: string, d: EmployeeUpdate) => c.json({ data: await svc(c).update(id, d) }),
}
