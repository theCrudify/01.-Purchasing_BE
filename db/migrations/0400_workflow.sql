-- Workflow group: document core, approval engine, notifications, handover. Idempotent.

INSERT INTO mst_permission ("Code","Module","Name") VALUES
 ('APPROVAL.CONFIG','APPROVAL','Configure approval templates, approver mappings, backups and delegations of others'),
 ('APPROVAL.REASSIGN','APPROVAL','Request reassignment of approval tasks held by other users'),
 ('HANDOVER.MANAGE','HANDOVER','Execute employee handovers'),
 ('DOC.VIEW_ALL','DOC','View every internal document (audit)'),
 ('DOC.DELETE','DOC','Delete / restore documents'),
 ('DOC.VIEW_DELETED','DOC','View deleted documents')
ON CONFLICT ("Code") DO NOTHING;

-- Template rows for document numbering: PeriodKey '000001' is never used for numbers; the first number of a month
-- copies Prefix / Format from the latest row of the series (see document.repository nextNumber).
INSERT INTO sys_number_series ("SeriesCode","PeriodKey","Prefix","Format","LastNumber","AllowPortal")
SELECT t, '000001', t, '{PREFIX}/{SEQ:4}/{MM}{YY}', 0, t IN ('SVR','QUO')
FROM unnest(ARRAY['SVR','PR','RFQ','QUO','PO','CTR','GR']) t
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Fallback status history: the ported guards (01xx) write hist_document_status from their own trigger.
-- This one is created only when no other tr_document trigger does it, so there is never a double entry.
CREATE OR REPLACE FUNCTION fn_wf_status_hist() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor bigint := NULLIF(current_setting('kpin.user_id', true), '')::bigint;
BEGIN
  IF TG_OP = 'INSERT' OR NEW."Status" IS DISTINCT FROM OLD."Status" THEN
    IF actor IS NULL THEN RAISE EXCEPTION 'Document status changes require the acting user (kpin.user_id).'; END IF;
    INSERT INTO hist_document_status ("DocumentId","FromStatus","ToStatus","ActorUserId","Remarks")
    VALUES (NEW."Id", CASE WHEN TG_OP = 'UPDATE' THEN OLD."Status" END, NEW."Status", actor, NULLIF(current_setting('kpin.remarks', true), ''));
  END IF;
  RETURN NULL;
END $$;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS trg_wf_status_hist ON tr_document;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
                 WHERE t.tgrelid = 'tr_document'::regclass AND NOT t.tgisinternal AND p.prosrc ILIKE '%hist_document_status%') THEN
    CREATE TRIGGER trg_wf_status_hist AFTER INSERT OR UPDATE OF "Status" ON tr_document FOR EACH ROW EXECUTE FUNCTION fn_wf_status_hist();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Views for joined lists (core/list-query points ListConfig.table at them).

CREATE OR REPLACE VIEW vw_wf_task AS
SELECT t."Id", t."PublicId", t."Status", t."StepNo", s."Name" AS "StepName", t."AssigneeUserId",
       au."PublicId" AS "AssigneePublicId", au."DisplayName" AS "AssigneeName",
       t."ReceivedAt", t."DueAt", t."ActedByUserId", bu."DisplayName" AS "ActedByName", t."ActingAs", t."ActedAt", t."Remarks",
       r."Id" AS "RequestId", r."RoundNo", r."Status" AS "RoundStatus", r."StartedAt",
       d."Id" AS "DocumentId", d."PublicId" AS "DocumentPublicId", d."DocType", d."DocNo", d."Title", d."Status" AS "DocStatus",
       d."DocDate", d."CurrencyCode", d."TotalAmount", d."TotalAmountBase", d."OwnerUserId", ou."DisplayName" AS "OwnerName", d."IsDeleted"
FROM tr_approval_task t
JOIN tr_approval_request r ON r."Id" = t."ApprovalRequestId"
JOIN tr_document d ON d."Id" = r."DocumentId"
JOIN mst_user au ON au."Id" = t."AssigneeUserId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_user bu ON bu."Id" = t."ActedByUserId"
LEFT JOIN mst_approval_template_step s ON s."TemplateId" = r."TemplateId" AND s."StepNo" = t."StepNo";

CREATE OR REPLACE VIEW vw_wf_document AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title", d."BpId", d."DepartmentId",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName", d."CurrencyCode", d."TotalAmount", d."TotalAmountBase",
       d."IsDeleted", d."DeletedAt", d."DeleteReason", du."DisplayName" AS "DeletedByName", d."UpdatedAt"
FROM tr_document d
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_user du ON du."Id" = d."DeletedBy";

CREATE OR REPLACE VIEW vw_wf_approver_mapping AS
SELECT m."Id", m."DocType", m."StepCode", m."TransactionTypeId", m."PaymentPurpose",
       pu."PublicId" AS "PreparerPublicId", pu."DisplayName" AS "PreparerName",
       au."PublicId" AS "ApproverPublicId", au."DisplayName" AS "ApproverName",
       m."IsActive", m."IsDeleted", m."UpdatedAt"
FROM mst_approver_mapping m
JOIN mst_user pu ON pu."Id" = m."PreparerUserId"
JOIN mst_user au ON au."Id" = m."ApproverUserId";

CREATE OR REPLACE VIEW vw_wf_approval_backup AS
SELECT b."Id", au."PublicId" AS "ApproverPublicId", au."DisplayName" AS "ApproverName",
       bu."PublicId" AS "BackupPublicId", bu."DisplayName" AS "BackupName", b."Notes", b."IsActive", b."IsDeleted", b."UpdatedAt"
FROM mst_approval_backup b
JOIN mst_user au ON au."Id" = b."ApproverUserId"
JOIN mst_user bu ON bu."Id" = b."BackupUserId";

CREATE OR REPLACE VIEW vw_wf_delegation AS
SELECT g."Id", g."FromUserId", fu."PublicId" AS "FromPublicId", fu."DisplayName" AS "FromName",
       g."ToUserId", tu."PublicId" AS "ToPublicId", tu."DisplayName" AS "ToName",
       g."DocType", d."PublicId" AS "DocumentPublicId", d."DocNo", g."StartsAt", g."EndsAt", g."Reason", g."RevokedAt", g."CreatedAt", g."CreatedBy",
       (g."RevokedAt" IS NULL AND now() >= g."StartsAt" AND now() < g."EndsAt") AS "IsCurrent"
FROM mst_approval_delegation g
JOIN mst_user fu ON fu."Id" = g."FromUserId"
JOIN mst_user tu ON tu."Id" = g."ToUserId"
LEFT JOIN tr_document d ON d."Id" = g."DocumentId";

CREATE OR REPLACE VIEW vw_wf_reassignment AS
SELECT r."Id", r."PublicId", r."Status", r."Reason", r."Remarks", r."RequestedAt", r."DecidedAt", r."DecisionRemarks", r."HandoverId",
       r."FromUserId", fu."PublicId" AS "FromPublicId", fu."DisplayName" AS "FromName",
       r."ToUserId", tu."PublicId" AS "ToPublicId", tu."DisplayName" AS "ToName",
       r."ApproverUserId", au."PublicId" AS "ApproverPublicId", au."DisplayName" AS "ApproverName",
       r."RequestedBy", qu."DisplayName" AS "RequestedByName",
       (SELECT count(*)::int FROM tr_approval_reassignment_item i WHERE i."ReassignmentId" = r."Id") AS "TaskCount"
FROM tr_approval_reassignment r
JOIN mst_user fu ON fu."Id" = r."FromUserId"
JOIN mst_user tu ON tu."Id" = r."ToUserId"
JOIN mst_user au ON au."Id" = r."ApproverUserId"
JOIN mst_user qu ON qu."Id" = r."RequestedBy";

CREATE OR REPLACE VIEW vw_wf_handover AS
SELECT h."Id", h."Reason", h."EffectiveDate", h."Status", h."CompletedAt", h."Remarks", h."ExecutedAt",
       h."DocumentsTransferred", h."MappingsTransferred", h."PicRolesTransferred", h."OrgRolesTransferred",
       fu."PublicId" AS "FromPublicId", fu."DisplayName" AS "FromName",
       tu."PublicId" AS "ToPublicId", tu."DisplayName" AS "ToName", eu."DisplayName" AS "ExecutedByName"
FROM tr_user_handover h
JOIN mst_user fu ON fu."Id" = h."FromUserId"
JOIN mst_user tu ON tu."Id" = h."ToUserId"
JOIN mst_user eu ON eu."Id" = h."ExecutedBy";

-- ---------------------------------------------------------------------------
-- Search (pg_trgm) and hot-path indexes
CREATE INDEX IF NOT EXISTS ix_tr_document_docno_trgm ON tr_document USING gin (lower("DocNo"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_tr_document_title_trgm ON tr_document USING gin (lower("Title"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_mst_user_displayname_trgm ON mst_user USING gin (lower("DisplayName"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_mst_user_email_trgm ON mst_user USING gin (lower("Email"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_mst_approval_template_code_trgm ON mst_approval_template USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_mst_approval_template_name_trgm ON mst_approval_template USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_tr_notification_title_trgm ON tr_notification USING gin (lower("Title"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_tr_approval_reassignment_remarks_trgm ON tr_approval_reassignment USING gin (lower("Remarks"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_tr_user_handover_remarks_trgm ON tr_user_handover USING gin (lower("Remarks"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_mst_approval_delegation_reason_trgm ON mst_approval_delegation USING gin (lower("Reason"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_mst_approval_backup_notes_trgm ON mst_approval_backup USING gin (lower("Notes"::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_tr_approval_task_open ON tr_approval_task ("AssigneeUserId") WHERE "Status" = 'PENDING';
CREATE INDEX IF NOT EXISTS ix_tr_notification_queued ON tr_notification ("Id") WHERE "EmailStatus" = 'QUEUED';
CREATE INDEX IF NOT EXISTS ix_mst_employee_superior ON mst_employee ("SuperiorUserId");
CREATE INDEX IF NOT EXISTS ix_tr_document_deleted ON tr_document ("DeletedAt" DESC) WHERE "IsDeleted";
