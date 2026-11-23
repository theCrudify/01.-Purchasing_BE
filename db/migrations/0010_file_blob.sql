-- Free-tier file storage: file bytes live in Postgres next to sys_file metadata (StorageProvider = 'DB').
-- shortcut: Neon free = 0.5 GB total; move to R2/S3 (StorageProvider 'R2') when attachments approach ~300 MB.
CREATE TABLE IF NOT EXISTS sys_file_blob (
  "FileId"  BIGINT PRIMARY KEY REFERENCES sys_file ("Id"),
  "Content" BYTEA NOT NULL
);
