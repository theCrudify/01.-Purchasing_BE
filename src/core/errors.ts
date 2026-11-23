export class HttpError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500, public code: string, message: string, public details?: unknown) {
    super(message)
  }
}
export const notFound = (what = 'Resource') => new HttpError(404, 'NOT_FOUND', `${what} not found`)
export const forbidden = (msg = 'Forbidden') => new HttpError(403, 'FORBIDDEN', msg)
export const unauthorized = (msg = 'Unauthorized') => new HttpError(401, 'UNAUTHORIZED', msg)
export const conflict = (msg: string) => new HttpError(409, 'CONFLICT', msg)
