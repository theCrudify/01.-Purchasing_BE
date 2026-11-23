-- Business Partner (Vendors / Suppliers) & Supplier Verification (SVR) migration. Idempotent.

INSERT INTO mst_permission ("Code","Module","Name") VALUES
 ('BP.VIEW','BP','View business partners / vendors'),
 ('BP.MANAGE','BP','Create and update business partners, contacts, addresses and bank accounts'),
 ('SVR.VIEW','SVR','View supplier verification documents'),
 ('SVR.CREATE','SVR','Create and submit supplier verification documents')
ON CONFLICT ("Code") DO NOTHING;

CREATE OR REPLACE VIEW vw_bp_list AS
SELECT bp."Id", bp."PublicId", bp."BpCode", bp."IsSupplier", bp."IsCustomer", bp."EntityType",
       bp."LegalName", bp."TradeName", bp."TaxId", bp."BusinessRegNo", bp."IsVatRegistered",
       bp."CountryCode", bp."Email", bp."Phone", bp."DefaultCurrencyCode",
       bp."PaymentTermId", pt."Code" AS "PaymentTermCode", pt."Name" AS "PaymentTermName",
       bp."OnboardingStatus", bp."OperationalStatus", bp."OperationalReason",
       bp."IsDeleted", bp."CreatedAt", bp."UpdatedAt"
FROM mst_business_partner bp
LEFT JOIN mst_payment_term pt ON pt."Id" = bp."PaymentTermId";

CREATE OR REPLACE VIEW vw_doc_svr AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."BpId", bp."PublicId" AS "BpPublicId", bp."BpCode", bp."LegalName" AS "BpName",
       v."RequestType", v."ReviewerUserId", ru."DisplayName" AS "ReviewerName",
       v."ReviewStartedAt", v."ReviewCompletedAt",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_bp_verification v
JOIN tr_document d ON d."Id" = v."DocumentId"
LEFT JOIN mst_business_partner bp ON bp."Id" = d."BpId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_user ru ON ru."Id" = v."ReviewerUserId";

CREATE INDEX IF NOT EXISTS ix_bp_bpcode_trgm ON mst_business_partner USING gin (lower("BpCode"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_bp_legalname_trgm ON mst_business_partner USING gin (lower("LegalName"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_bp_taxid_trgm ON mst_business_partner USING gin (lower("TaxId"::text) gin_trgm_ops);
