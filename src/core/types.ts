export type Actor = {
  id: number
  publicId: string
  userType: 'INTERNAL' | 'BP' | 'SYSTEM'
  email: string
  displayName: string
  sessionId: number
  permissions: ReadonlySet<string>
}
export type Paged<T> = { data: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }
