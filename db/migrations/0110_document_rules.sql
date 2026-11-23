-- Document core rules enforced by the database (Postgres port of the in-scope parts of constraints.sql / triggers.sql / guards.sql).
-- Idempotent. Errors: RAISE ... USING ERRCODE='P0001' → API 422; CHECK → 23514 → 422.

-- ---------------------------------------------------------------------------
-- tr_document
CREATE UNIQUE INDEX IF NOT EXISTS ux_document_docno ON tr_document ("DocType", "DocNo") WHERE "DocNo" IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_document_type_status ON tr_document ("DocType", "Status") WHERE NOT "IsDeleted";
CREATE INDEX IF NOT EXISTS ix_document_owner ON tr_document ("OwnerUserId", "Status");
CREATE INDEX IF NOT EXISTS ix_document_docno_trgm ON tr_document USING gin (lower("DocNo"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_document_title_trgm ON tr_document USING gin (lower("Title"::text) gin_trgm_ops);

DO $$ BEGIN
  ALTER TABLE tr_document ADD CONSTRAINT ck_document_numbered CHECK ("Status" = 'DRAFT' OR "DocNo" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE tr_document ADD CONSTRAINT ck_document_softdelete
    CHECK (NOT "IsDeleted" OR ("Status" IN ('DRAFT','CANCELLED','REJECTED','WITHDRAWN','SUPERSEDED','NOT_AWARDED') AND "DeleteReason" IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE tr_document ADD CONSTRAINT ck_document_cancel_reason CHECK ("Status" <> 'CANCELLED' OR "CancelReason" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Status moves must follow mst_status_transition; currency / rate / BP are locked after DRAFT; deleted documents are frozen.
CREATE OR REPLACE FUNCTION fn_document_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('kpin.recalc', true) = '1' AND pg_has_role(current_user, (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()), 'MEMBER') THEN
    RETURN NEW; -- data migration by the owner only
  END IF;
  IF OLD."IsDeleted" AND NEW."IsDeleted" THEN
    RAISE EXCEPTION 'E51030: A deleted document cannot be changed. Restore it first.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW."Status" IS DISTINCT FROM OLD."Status" AND NOT EXISTS (
       SELECT 1 FROM mst_status_transition t WHERE t."DocType" = NEW."DocType" AND t."FromStatus" = OLD."Status" AND t."ToStatus" = NEW."Status") THEN
    RAISE EXCEPTION 'E51011: Status change % → % is not allowed for %', OLD."Status", NEW."Status", NEW."DocType" USING ERRCODE = 'P0001';
  END IF;
  IF OLD."Status" NOT IN ('DRAFT','RETURNED','REVISION_REQUIRED') AND (
       NEW."CurrencyCode" IS DISTINCT FROM OLD."CurrencyCode" OR NEW."ExchangeRate" IS DISTINCT FROM OLD."ExchangeRate" OR NEW."BpId" IS DISTINCT FROM OLD."BpId") THEN
    RAISE EXCEPTION 'E51020: Currency, exchange rate and business partner are locked once the document is submitted' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_document_guard ON tr_document;
CREATE TRIGGER trg_document_guard BEFORE UPDATE ON tr_document FOR EACH ROW EXECUTE FUNCTION fn_document_guard();

-- Exchange-rate snapshot: valas documents without a rate take the MIDDLE rate valid on DocDate; IDR = 1. TotalAmountBase follows.
CREATE OR REPLACE FUNCTION fn_document_rate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  IF NEW."CurrencyCode" = 'IDR' THEN NEW."ExchangeRate" := 1; NEW."ExchangeRateDate" := NULL;
  ELSIF NEW."CurrencyCode" IS NOT NULL AND NEW."ExchangeRate" IS NULL THEN
    SELECT "RateToBase", "RateDate" INTO r FROM mst_exchange_rate
     WHERE "CurrencyCode" = NEW."CurrencyCode" AND "RateType" = 'MIDDLE' AND "RateDate" <= NEW."DocDate" ORDER BY "RateDate" DESC LIMIT 1;
    IF FOUND THEN NEW."ExchangeRate" := r."RateToBase"; NEW."ExchangeRateDate" := r."RateDate"; END IF;
  END IF;
  IF NEW."Status" <> 'DRAFT' AND NEW."CurrencyCode" IS NOT NULL AND NEW."ExchangeRate" IS NULL THEN
    RAISE EXCEPTION 'E51021: No exchange rate for % on %; enter one under Exchange Rates', NEW."CurrencyCode", NEW."DocDate" USING ERRCODE = 'P0001';
  END IF;
  NEW."TotalAmountBase" := round(NEW."TotalAmount" * NEW."ExchangeRate", 2);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_document_rate ON tr_document;
CREATE TRIGGER trg_document_rate BEFORE INSERT OR UPDATE OF "CurrencyCode", "ExchangeRate", "DocDate", "TotalAmount", "Status" ON tr_document
  FOR EACH ROW EXECUTE FUNCTION fn_document_rate();

-- Every status change is recorded with the actor and kpin.remarks.
CREATE OR REPLACE FUNCTION fn_document_status_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW."Status" IS DISTINCT FROM OLD."Status" THEN
    INSERT INTO hist_document_status ("DocumentId","FromStatus","ToStatus","ActorUserId","Remarks")
    VALUES (NEW."Id", CASE WHEN TG_OP = 'UPDATE' THEN OLD."Status" END, NEW."Status",
            COALESCE(NULLIF(current_setting('kpin.user_id', true), '')::bigint, NEW."UpdatedBy", NEW."OwnerUserId"),
            NULLIF(left(current_setting('kpin.remarks', true), 1000), ''));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_document_status_history ON tr_document;
CREATE TRIGGER trg_document_status_history AFTER INSERT OR UPDATE OF "Status" ON tr_document FOR EACH ROW EXECUTE FUNCTION fn_document_status_history();

-- ---------------------------------------------------------------------------
-- Approval: decisions need remarks when rejecting / returning; one live task per assignee per step; job title snapshot.
DO $$ BEGIN
  ALTER TABLE tr_approval_task ADD CONSTRAINT ck_task_remarks CHECK ("Status" NOT IN ('REJECTED','RETURNED') OR length(trim("Remarks")) > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE tr_approval_task ADD CONSTRAINT ck_task_status CHECK ("Status" IN ('WAITING','PENDING','APPROVED','REJECTED','RETURNED','SKIPPED','CANCELLED','REASSIGNED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE tr_approval_request ADD CONSTRAINT ck_request_status CHECK ("Status" IN ('PENDING','APPROVED','REJECTED','RETURNED','CANCELLED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS ux_task_live_assignee ON tr_approval_task ("ApprovalRequestId", "StepNo", "AssigneeUserId") WHERE "Status" IN ('WAITING','PENDING');
CREATE UNIQUE INDEX IF NOT EXISTS ux_request_one_open ON tr_approval_request ("DocumentId") WHERE "Status" = 'PENDING';
CREATE INDEX IF NOT EXISTS ix_task_assignee_open ON tr_approval_task ("AssigneeUserId") WHERE "Status" = 'PENDING';

CREATE OR REPLACE FUNCTION fn_task_job_title() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."ActedByUserId" IS NOT NULL AND NEW."ActedByUserId" IS DISTINCT FROM OLD."ActedByUserId" THEN
    NEW."ActorJobTitle" := (SELECT "JobTitle" FROM mst_employee WHERE "UserId" = NEW."ActedByUserId");
  END IF;
  IF OLD."Status" NOT IN ('WAITING','PENDING') AND NEW."Status" IS DISTINCT FROM OLD."Status" THEN
    RAISE EXCEPTION 'E51045: The approval task was already decided' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_task_job_title ON tr_approval_task;
CREATE TRIGGER trg_task_job_title BEFORE UPDATE ON tr_approval_task FOR EACH ROW EXECUTE FUNCTION fn_task_job_title();

-- A document is in PENDING_APPROVAL exactly while it has an open round (checked at commit, after the engine's multi-step update).
CREATE OR REPLACE FUNCTION fn_document_round_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE open_round boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM tr_approval_request WHERE "DocumentId" = NEW."Id" AND "Status" = 'PENDING') INTO open_round;
  IF (NEW."Status" = 'PENDING_APPROVAL') <> open_round THEN
    RAISE EXCEPTION 'E51012: Document % status % does not match its approval round', NEW."Id", NEW."Status" USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_document_round_check ON tr_document;
CREATE CONSTRAINT TRIGGER trg_document_round_check AFTER INSERT OR UPDATE OF "Status" ON tr_document
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_document_round_check();

-- ---------------------------------------------------------------------------
INSERT INTO mst_permission ("Code","Module","Name") VALUES
 ('DOC.VIEW_ALL','DOC','View every document (auditors, purchasing admins)')
ON CONFLICT ("Code") DO NOTHING;
