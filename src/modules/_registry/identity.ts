import type { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { userLookupRoutes, userRoutes } from '../user/user.routes'
import { roleRoutes } from '../role/role.routes'
import { permissionRoutes } from '../permission/permission.routes'
import { employeeRoutes } from '../employee/employee.routes'
import { costCenterRoutes } from '../cost-center/cost-center.routes'
import { auditRoutes } from '../audit/audit.routes'
import { securityRoutes } from '../security/security.routes'
import { profileRoutes } from '../profile/profile.routes'
import { passwordResetRoutes } from '../password-reset/password-reset.routes'

/** Routes owned by the "identity" group. */
export const routes: [string, Hono<AppEnv, any, any>][] = [
  ['/users', userRoutes],
  ['/user-lookup', userLookupRoutes],
  ['/roles', roleRoutes],
  ['/permissions', permissionRoutes],
  ['/employees', employeeRoutes],
  ['/cost-centers', costCenterRoutes],
  ['/audit', auditRoutes],
  ['/security', securityRoutes],
  ['/profile', profileRoutes],
  ['/password-reset', passwordResetRoutes],
]
