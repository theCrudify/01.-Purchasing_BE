import type { Queryable } from '../../core/db'
import { ViewCrudRepository } from '../_master/shared'
import { formNoteDef, formNoteView } from './form-note.schema'

/** SQL only. */
export class FormNoteRepository extends ViewCrudRepository {
  constructor(q: Queryable) { super(q, formNoteDef, formNoteView) }

  /** internal users for the "for user" picker (form notes are internal-only) */
  userLookup(q: string | undefined) {
    const like = `%${(q ?? '').toLowerCase().replace(/[\\%_]/g, (m) => '\\' + m)}%`
    return this.q.query(`SELECT "PublicId" AS id, "DisplayName" AS "displayName", "Email" AS email FROM mst_user
      WHERE "UserType"='INTERNAL' AND (lower("DisplayName") LIKE $1 OR lower("Email") LIKE $1) ORDER BY "DisplayName" LIMIT 20`, [like])
  }
  async user(publicId: string) {
    return (await this.q.query<{ id: string; internalId: number; displayName: string }>(`SELECT "PublicId" AS id, "Id" AS "internalId", "DisplayName" AS "displayName", "Email" AS email FROM mst_user WHERE "PublicId"=$1 AND "UserType"='INTERNAL'`, [publicId]))[0]
  }
}
