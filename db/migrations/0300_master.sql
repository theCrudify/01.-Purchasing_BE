-- Master data group: permissions, trigram search indexes, list views. Idempotent.

INSERT INTO mst_permission ("Code","Module","Name") VALUES
 ('FX.MANAGE','FX','Activate currencies, enter / import / delete exchange rates'),
 ('BUDGET.MANAGE','BUDGET','Create / edit purchasing budgets'),
 ('SYS.NUMBER_SERIES_MANAGE','SYS','Edit document number series prefix / format')
ON CONFLICT ("Code") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Exchange rates imported from Frankfurter (ECB reference rates) are tagged Source = 'ECB'.
-- Widen the Source CHECKs ported from SQL Server (whatever their name) to allow it.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conrelid::regclass::text AS tbl, conname FROM pg_constraint
            WHERE contype = 'c' AND conrelid IN ('mst_exchange_rate'::regclass, 'hist_rate_import'::regclass)
              AND pg_get_constraintdef(oid) LIKE '%"Source"%' AND conname NOT LIKE 'ck_master_%' LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;
ALTER TABLE mst_exchange_rate DROP CONSTRAINT IF EXISTS ck_master_exchange_rate_source;
ALTER TABLE mst_exchange_rate ADD CONSTRAINT ck_master_exchange_rate_source CHECK ("Source" IN ('BI','KMK','BANK','MANUAL','ECB'));
ALTER TABLE hist_rate_import DROP CONSTRAINT IF EXISTS ck_master_rate_import_source;
ALTER TABLE hist_rate_import ADD CONSTRAINT ck_master_rate_import_source CHECK ("Source" IN ('BI','KMK','SAP_ORTT','MANUAL_FILE','ECB'));

-- ---------------------------------------------------------------------------
-- One trigram GIN index per searchable column (list ?q= uses lower(col::text) LIKE '%tok%').
CREATE INDEX IF NOT EXISTS ix_currency_code_trgm ON mst_currency USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_currency_name_trgm ON mst_currency USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_exchange_rate_ccy_trgm ON mst_exchange_rate USING gin (lower("CurrencyCode"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_exchange_rate_date ON mst_exchange_rate ("RateDate", "RateType");
CREATE INDEX IF NOT EXISTS ix_tax_code_code_trgm ON mst_tax_code USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_tax_code_name_trgm ON mst_tax_code USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_payment_term_code_trgm ON mst_payment_term USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_payment_term_name_trgm ON mst_payment_term USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_uom_code_trgm ON mst_uom USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_uom_name_trgm ON mst_uom USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_category_code_trgm ON mst_category USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_category_name_trgm ON mst_category USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_purchase_class_code_trgm ON mst_purchase_class USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_purchase_class_name_trgm ON mst_purchase_class USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_item_code_trgm ON mst_item USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_item_name_trgm ON mst_item USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_form_note_body_trgm ON mst_form_note USING gin (lower("Body"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_form_note_doctype_trgm ON mst_form_note USING gin (lower("DocType"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_bank_code_trgm ON mst_bank USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_bank_name_trgm ON mst_bank USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_bank_swift_trgm ON mst_bank USING gin (lower("SwiftCode"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_bp_document_type_code_trgm ON mst_bp_document_type USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_bp_document_type_name_trgm ON mst_bp_document_type USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_budget_remarks_trgm ON mst_budget USING gin (lower("Remarks"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_master_user_display_name_trgm ON mst_user USING gin (lower("DisplayName"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_number_series_code_trgm ON sys_number_series USING gin (lower("SeriesCode"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_number_series_prefix_trgm ON sys_number_series USING gin (lower("Prefix"::text) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- List views (joins for display names). Base columns come through t.*.
CREATE OR REPLACE VIEW vw_exchange_rate AS
SELECT r."CurrencyCode" || '.' || r."RateType" || '.' || to_char(r."RateDate", 'YYYY-MM-DD') AS "Key",
       r.*, c."Name" AS "CurrencyName"
FROM mst_exchange_rate r JOIN mst_currency c ON c."Code" = r."CurrencyCode";

CREATE OR REPLACE VIEW vw_item AS
SELECT i.*, c."Code" AS "CategoryCode", c."Name" AS "CategoryName", u."Code" AS "UomCode",
       pu."Code" AS "PurchaseUomCode", t."Code" AS "VatTaxCode"
FROM mst_item i
JOIN mst_category c ON c."Id" = i."CategoryId"
JOIN mst_uom u ON u."Id" = i."UomId"
LEFT JOIN mst_uom pu ON pu."Id" = i."PurchaseUomId"
LEFT JOIN mst_tax_code t ON t."Id" = i."VatTaxCodeId";

CREATE OR REPLACE VIEW vw_category AS
SELECT c.*, p."Code" AS "ParentCode" FROM mst_category c LEFT JOIN mst_category p ON p."Id" = c."ParentId";

CREATE OR REPLACE VIEW vw_form_note AS
SELECT f.*, u."PublicId" AS "UserPublicId", u."DisplayName" AS "UserName" FROM mst_form_note f LEFT JOIN mst_user u ON u."Id" = f."UserId";

CREATE OR REPLACE VIEW vw_budget AS
SELECT b.*, d."Code" AS "DepartmentCode", d."Name" AS "DepartmentName", pc."Name" AS "PurchaseClassName"
FROM mst_budget b JOIN mst_department d ON d."Id" = b."DepartmentId"
LEFT JOIN mst_purchase_class pc ON pc."Id" = b."PurchaseClassId";

-- single-table view: auto-updatable, so the generic CRUD repository can PATCH through it by "Key"
CREATE OR REPLACE VIEW vw_number_series AS
SELECT n."SeriesCode" || '.' || n."PeriodKey" AS "Key", n.* FROM sys_number_series n;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'purchasing_app') THEN
    GRANT SELECT ON vw_exchange_rate, vw_item, vw_category, vw_form_note, vw_budget, vw_number_series TO purchasing_app;
    GRANT UPDATE ON vw_number_series TO purchasing_app;
  END IF;
END $$;
