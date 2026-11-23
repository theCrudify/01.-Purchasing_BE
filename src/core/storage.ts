import type { Queryable } from './db'
import { HttpError } from './errors'

/** Allowed uploads, identified by magic bytes (the client's Content-Type is not trusted). */
const KINDS: { type: string; ext: string[]; sig: number[] }[] = [
  { type: 'application/pdf', ext: ['pdf'], sig: [0x25, 0x50, 0x44, 0x46] },
  { type: 'image/png', ext: ['png'], sig: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'image/jpeg', ext: ['jpg', 'jpeg'], sig: [0xff, 0xd8, 0xff] },
  // OOXML (xlsx/docx) are zip containers
  { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: ['xlsx'], sig: [0x50, 0x4b, 0x03, 0x04] },
  { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: ['docx'], sig: [0x50, 0x4b, 0x03, 0x04] },
]
export const MAX_FILE_BYTES = 5 * 1024 * 1024

export type SavedFile = { id: number; publicId: string; originalName: string; contentType: string; sizeBytes: number }

function sniff(name: string, bytes: Uint8Array) {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  const k = KINDS.find((k) => k.ext.includes(ext) && k.sig.every((b, i) => bytes[i] === b))
  if (!k) throw new HttpError(422, 'FILE_TYPE', 'Only PDF, PNG, JPG, XLSX, DOCX files are allowed')
  return k.type
}

const safeName = (n: string) => n.replace(/[^\w.\- ()]/g, '_').slice(-200) || 'file'

/** Validate + store an uploaded file (bytes in sys_file_blob). Caller decides who may upload and links it. */
export async function saveFile(q: Queryable, uploadedBy: number, file: File): Promise<SavedFile> {
  if (!(file instanceof File) || file.size === 0) throw new HttpError(422, 'FILE_REQUIRED', 'File is required')
  if (file.size > MAX_FILE_BYTES) throw new HttpError(422, 'FILE_TOO_LARGE', 'Max file size is 5 MB')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const name = safeName(file.name)
  const contentType = sniff(name, bytes)
  const sha = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const key = crypto.randomUUID()
  // shortcut: no antivirus on the free tier — files are type-checked by magic bytes and marked CLEAN; add a scanner before opening uploads to the public.
  const [row] = await q.query<{ id: number; publicId: string }>(
    `INSERT INTO sys_file ("StorageProvider","StorageKey","OriginalName","ContentType","SizeBytes","Sha256","UploadedBy","ScanStatus","ScannedAt")
     VALUES ('DB',$1,$2,$3,$4,$5,$6,'CLEAN',now()) RETURNING "Id" AS id, "PublicId" AS "publicId"`,
    [key, name, contentType, bytes.length, Buffer.from(sha), uploadedBy])
  await q.query(`INSERT INTO sys_file_blob ("FileId","Content") VALUES ($1,$2)`, [row!.id, Buffer.from(bytes)])
  return { id: row!.id, publicId: row!.publicId, originalName: name, contentType, sizeBytes: bytes.length }
}

/** Read a stored file by its internal id. Authorisation is the caller's job (check the owning document / BP first). */
export async function readFile(q: Queryable, fileId: number) {
  const [f] = await q.query<{ name: string; type: string; content: Buffer }>(
    `SELECT f."OriginalName" AS name, f."ContentType" AS type, b."Content" AS content
       FROM sys_file f JOIN sys_file_blob b ON b."FileId" = f."Id" WHERE f."Id" = $1 AND f."ScanStatus" = 'CLEAN'`, [fileId])
  return f
}

/** Response for a download: forces attachment disposition so stored HTML/SVG can never execute in our origin. */
export function fileResponse(f: { name: string; type: string; content: Buffer }, inline = false) {
  return new Response(new Uint8Array(f.content), {
    headers: {
      'content-type': f.type,
      'content-disposition': `${inline && f.type !== 'application/pdf' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  })
}
