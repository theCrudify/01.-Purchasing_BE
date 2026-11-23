-- Foundation that Prisma cannot express. Idempotent: safe to re-run.
-- Order: 0001_init.generated.sql → 0002_extras.sql → 0003+ (ported constraints / triggers / guards / RLS / seeds, module indexes).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- UpdatedAt is bumped by the DB on every UPDATE (Prisma's @updatedAt is client-side only).
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW."UpdatedAt" := now(); RETURN NEW; END $$;

-- Generic audit: every INSERT/UPDATE/DELETE on mst_* and tr_* goes to hist_audit_log.
-- Actor comes from set_config('purchasing.user_id', ..., true), set by the API at the start of each transaction.
CREATE OR REPLACE FUNCTION fn_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r jsonb := to_jsonb(COALESCE(NEW, OLD)); k text; ch jsonb;
        actor bigint := NULLIF(current_setting('purchasing.user_id', true), '')::bigint;
BEGIN
  k := COALESCE(r->>'Id', r->>'DocumentId', r->>'PublicId', r->>'Code', r::text);
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)) INTO ch
      FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
     WHERE n.value IS DISTINCT FROM o.value AND n.key NOT IN ('UpdatedAt', 'Version');
    IF ch IS NULL THEN RETURN NEW; END IF;
  ELSE
    ch := r;
  END IF;
  INSERT INTO hist_audit_log ("TableName","RecordKey","Action","Changes","ActorUserId")
  VALUES (TG_TABLE_NAME, left(k, 100), TG_OP, ch::text, actor);
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.table_name FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.column_name = 'UpdatedAt' LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I', t.table_name);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()', t.table_name);
  END LOOP;
  FOR t IN SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND (table_name LIKE 'mst\_%' OR table_name LIKE 'tr\_%') LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit ON %I', t.table_name);
    EXECUTE format('CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_audit()', t.table_name);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Contains-search stays index-backed: one trigram GIN index per searchable column
-- (the list builder matches lower(col::text) LIKE '%tok%'). Modules add theirs in later migrations.
CREATE INDEX IF NOT EXISTS ix_department_code_trgm ON mst_department USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_department_name_trgm ON mst_department USING gin (lower("Name"::text) gin_trgm_ops);

INSERT INTO mst_permission ("Code","Module","Name") VALUES
 ('MASTER.VIEW','MASTER','View master data'),
 ('MASTER.MANAGE','MASTER','Create / edit master data'),
 ('MASTER.DELETE','MASTER','Soft-delete master data'),
 ('MASTER.VIEW_DELETED','MASTER','View deleted master data'),
 ('DOC.DELETE','DOC','Delete / restore documents'),
 ('DOC.VIEW_DELETED','DOC','View deleted documents')
ON CONFLICT ("Code") DO NOTHING;
