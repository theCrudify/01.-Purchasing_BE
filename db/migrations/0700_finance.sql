-- Finance, Expense & Invoicing migration:
-- CA (Cash Advance), STL (Settlement), RMB (Reimbursement), INV (AP Invoice),
-- PAY (Outgoing Payment: OPAP / OPCA / OPRMB), ARI (AR Invoice), RCV (Incoming Receipt).
-- Idempotent.

-- 1. Permissions
INSERT INTO mst_permission ("Code","Module","Name") VALUES
 ('CA.VIEW','CA','View cash advances'),
 ('CA.CREATE','CA','Create and submit cash advances'),
 ('STL.VIEW','STL','View cash advance settlements'),
 ('STL.CREATE','STL','Create and submit cash advance settlements'),
 ('RMB.VIEW','RMB','View employee/vendor reimbursements'),
 ('RMB.CREATE','RMB','Create and submit reimbursements'),
 ('INV.VIEW','INV','View AP invoices'),
 ('INV.CREATE','INV','Create and submit AP invoices'),
 ('PAY.VIEW','PAY','View outgoing payments (OPAP, OPCA, Outgoing Reimbursement)'),
 ('PAY.CREATE','PAY','Create and submit outgoing payments'),
 ('ARI.VIEW','ARI','View AR invoices'),
 ('ARI.CREATE','ARI','Create and submit AR invoices'),
 ('RCV.VIEW','RCV','View incoming receipts'),
 ('RCV.CREATE','RCV','Create and submit incoming receipts')
ON CONFLICT ("Code") DO NOTHING;

INSERT INTO mst_role_permission ("RoleId","PermissionId")
SELECT r."Id", p."Id" FROM mst_role r CROSS JOIN mst_permission p WHERE r."Code"='ADMIN'
ON CONFLICT DO NOTHING;

-- 2. Status Transitions for ARI, CA, INV, PAY, RCV, RMB, STL
INSERT INTO mst_status_transition ("DocType","FromStatus","ToStatus","RequiredApproval","AllowBp","Description") VALUES
 ('ARI', 'DRAFT', 'PENDING_APPROVAL', 'PENDING', false, 'submit'),
 ('ARI', 'PENDING_APPROVAL', 'APPROVED', 'APPROVED', false, 'approval completed'),
 ('ARI', 'PENDING_APPROVAL', 'RETURNED', 'RETURNED', false, 'returned for revision'),
 ('ARI', 'PENDING_APPROVAL', 'REJECTED', 'REJECTED', false, 'rejected'),
 ('ARI', 'RETURNED', 'PENDING_APPROVAL', 'PENDING', false, 'resubmit'),
 ('ARI', 'APPROVED', 'ISSUED', NULL, false, 'sent to customer'),
 ('ARI', 'ISSUED', 'PARTIALLY_PAID', NULL, false, NULL),
 ('ARI', 'ISSUED', 'PAID', NULL, false, NULL),
 ('ARI', 'PARTIALLY_PAID', 'PAID', NULL, false, NULL),
 ('ARI', 'DRAFT', 'CANCELLED', NULL, false, NULL),
 ('ARI', 'RETURNED', 'CANCELLED', NULL, false, NULL),
 ('ARI', 'APPROVED', 'CANCELLED', NULL, false, NULL),
 ('ARI', 'ISSUED', 'CANCELLED', NULL, false, 'credit note required'),
 ('CA', 'DRAFT', 'PENDING_APPROVAL', 'PENDING', false, 'submit'),
 ('CA', 'PENDING_APPROVAL', 'APPROVED', 'APPROVED', false, 'approval completed'),
 ('CA', 'PENDING_APPROVAL', 'RETURNED', 'RETURNED', false, 'returned for revision'),
 ('CA', 'PENDING_APPROVAL', 'REJECTED', 'REJECTED', false, 'rejected'),
 ('CA', 'RETURNED', 'PENDING_APPROVAL', 'PENDING', false, 'resubmit'),
 ('CA', 'APPROVED', 'PAYMENT_PROCESSING', NULL, false, NULL),
 ('CA', 'PAYMENT_PROCESSING', 'DISBURSED', NULL, false, NULL),
 ('CA', 'PAYMENT_PROCESSING', 'APPROVED', NULL, false, 'payment failed'),
 ('CA', 'DISBURSED', 'SETTLED', NULL, false, 'settlement approved'),
 ('CA', 'DISBURSED', 'CLOSED', NULL, false, 'personal loan repaid'),
 ('CA', 'SETTLED', 'CLOSED', NULL, false, NULL),
 ('CA', 'DRAFT', 'CANCELLED', NULL, false, NULL),
 ('CA', 'RETURNED', 'CANCELLED', NULL, false, NULL),
 ('CA', 'APPROVED', 'CANCELLED', NULL, false, 'not disbursed'),
 ('INV', 'DRAFT', 'SUBMITTED', NULL, true, 'BP submits'),
 ('INV', 'DRAFT', 'PENDING_APPROVAL', 'PENDING', false, 'entered internally'),
 ('INV', 'SUBMITTED', 'PENDING_APPROVAL', 'PENDING', false, 'received, approval starts'),
 ('INV', 'PENDING_APPROVAL', 'APPROVED', 'APPROVED', false, NULL),
 ('INV', 'PENDING_APPROVAL', 'RETURNED', 'RETURNED', false, NULL),
 ('INV', 'PENDING_APPROVAL', 'REJECTED', 'REJECTED', false, NULL),
 ('INV', 'RETURNED', 'SUBMITTED', NULL, true, 'BP resubmits'),
 ('INV', 'RETURNED', 'PENDING_APPROVAL', 'PENDING', false, 'resubmitted internally'),
 ('INV', 'APPROVED', 'PAYMENT_PROCESSING', NULL, false, 'payment created'),
 ('INV', 'PAYMENT_PROCESSING', 'PARTIALLY_PAID', NULL, false, NULL),
 ('INV', 'PAYMENT_PROCESSING', 'PAID', NULL, false, NULL),
 ('INV', 'PAYMENT_PROCESSING', 'APPROVED', NULL, false, 'payment failed / cancelled'),
 ('INV', 'PARTIALLY_PAID', 'PAYMENT_PROCESSING', NULL, false, NULL),
 ('INV', 'PARTIALLY_PAID', 'PAID', NULL, false, NULL),
 ('INV', 'DRAFT', 'CANCELLED', NULL, true, NULL),
 ('INV', 'SUBMITTED', 'CANCELLED', NULL, true, NULL),
 ('INV', 'RETURNED', 'CANCELLED', NULL, true, NULL),
 ('INV', 'APPROVED', 'CANCELLED', NULL, false, 'not paid'),
 ('PAY', 'DRAFT', 'PENDING_APPROVAL', 'PENDING', false, 'submit'),
 ('PAY', 'PENDING_APPROVAL', 'APPROVED', 'APPROVED', false, 'approval completed'),
 ('PAY', 'PENDING_APPROVAL', 'RETURNED', 'RETURNED', false, 'returned for revision'),
 ('PAY', 'PENDING_APPROVAL', 'REJECTED', 'REJECTED', false, 'rejected'),
 ('PAY', 'RETURNED', 'PENDING_APPROVAL', 'PENDING', false, 'resubmit'),
 ('PAY', 'APPROVED', 'SENT_TO_BANK', NULL, false, NULL),
 ('PAY', 'SENT_TO_BANK', 'POSTED', NULL, false, 'bank accepted'),
 ('PAY', 'SENT_TO_BANK', 'COMPLETED', NULL, false, NULL),
 ('PAY', 'POSTED', 'COMPLETED', NULL, false, 'funds transferred'),
 ('PAY', 'SENT_TO_BANK', 'FAILED', NULL, false, NULL),
 ('PAY', 'POSTED', 'FAILED', NULL, false, NULL),
 ('PAY', 'FAILED', 'SENT_TO_BANK', NULL, false, 'retry'),
 ('PAY', 'DRAFT', 'CANCELLED', NULL, false, NULL),
 ('PAY', 'RETURNED', 'CANCELLED', NULL, false, NULL),
 ('PAY', 'APPROVED', 'CANCELLED', NULL, false, NULL),
 ('PAY', 'FAILED', 'CANCELLED', NULL, false, NULL),
 ('RCV', 'DRAFT', 'POSTED', NULL, false, NULL),
 ('RCV', 'DRAFT', 'CANCELLED', NULL, false, NULL),
 ('RCV', 'POSTED', 'CANCELLED', NULL, false, 'reversal'),
 ('RMB', 'DRAFT', 'PENDING_APPROVAL', 'PENDING', false, 'submit'),
 ('RMB', 'PENDING_APPROVAL', 'APPROVED', 'APPROVED', false, 'approval completed'),
 ('RMB', 'PENDING_APPROVAL', 'RETURNED', 'RETURNED', false, 'returned for revision'),
 ('RMB', 'PENDING_APPROVAL', 'REJECTED', 'REJECTED', false, 'rejected'),
 ('RMB', 'RETURNED', 'PENDING_APPROVAL', 'PENDING', false, 'resubmit'),
 ('RMB', 'APPROVED', 'PAYMENT_PROCESSING', NULL, false, NULL),
 ('RMB', 'PAYMENT_PROCESSING', 'PARTIALLY_PAID', NULL, false, NULL),
 ('RMB', 'PAYMENT_PROCESSING', 'PAID', NULL, false, NULL),
 ('RMB', 'PAYMENT_PROCESSING', 'APPROVED', NULL, false, 'payment failed'),
 ('RMB', 'PARTIALLY_PAID', 'PAYMENT_PROCESSING', NULL, false, NULL),
 ('RMB', 'PARTIALLY_PAID', 'PAID', NULL, false, NULL),
 ('RMB', 'DRAFT', 'CANCELLED', NULL, false, NULL),
 ('RMB', 'RETURNED', 'CANCELLED', NULL, false, NULL),
 ('RMB', 'APPROVED', 'CANCELLED', NULL, false, 'not paid'),
 ('STL', 'DRAFT', 'PENDING_APPROVAL', 'PENDING', false, 'submit'),
 ('STL', 'PENDING_APPROVAL', 'APPROVED', 'APPROVED', false, 'approval completed'),
 ('STL', 'PENDING_APPROVAL', 'RETURNED', 'RETURNED', false, 'returned for revision'),
 ('STL', 'PENDING_APPROVAL', 'REJECTED', 'REJECTED', false, 'rejected'),
 ('STL', 'RETURNED', 'PENDING_APPROVAL', 'PENDING', false, 'resubmit'),
 ('STL', 'APPROVED', 'CLOSED', NULL, false, 'difference refunded / topped up'),
 ('STL', 'DRAFT', 'CANCELLED', NULL, false, NULL),
 ('STL', 'RETURNED', 'CANCELLED', NULL, false, NULL)
ON CONFLICT ("DocType","FromStatus","ToStatus") DO NOTHING;

-- 3. Number Series for Finance & Expense DocTypes
INSERT INTO sys_number_series ("SeriesCode","PeriodKey","Prefix","Format","LastNumber","AllowPortal") VALUES
 ('CA',  '000001', 'CA',  '{PREFIX}/{SEQ:4}/{MM}{YY}', 0, false),
 ('STL', '000001', 'STL', '{PREFIX}/{SEQ:4}/{MM}{YY}', 0, false),
 ('RMB', '000001', 'RMB', '{PREFIX}/{SEQ:4}/{MM}{YY}', 0, false),
 ('INV', '000001', 'INV', '{PREFIX}/{SEQ:4}/{MM}{YY}', 0, true),
 ('PAY', '000001', 'PAY', '{PREFIX}/{SEQ:4}/{MM}{YY}', 0, false),
 ('ARI', '000001', 'ARI', '{PREFIX}/{SEQ:4}/{MM}{YY}', 0, false),
 ('RCV', '000001', 'RCV', '{PREFIX}/{SEQ:4}/{MM}{YY}', 0, false)
ON CONFLICT ("SeriesCode","PeriodKey") DO NOTHING;

-- 4. Seed Finance Master Data (COA, Expense Category, Transaction Types, Company Bank Accounts)
INSERT INTO mst_coa ("AccountCode","AccountName","AccountType","IsPostable","IsActive") VALUES
 ('110100', 'Kas & Bank Operasional IDR (BCA / MUFG)', 'ASSET', true, true),
 ('110200', 'Bank Operasional Valas USD (MUFG)', 'ASSET', true, true),
 ('112100', 'Piutang Usaha (Accounts Receivable)', 'ASSET', true, true),
 ('114100', 'Uang Muka Karyawan (Cash Advance Control)', 'ASSET', true, true),
 ('210100', 'Hutang Usaha (Accounts Payable Control)', 'LIABILITY', true, true),
 ('210200', 'Hutang Reimbursement Karyawan', 'LIABILITY', true, true),
 ('410100', 'Pendapatan Penjualan Barang & Jasa', 'REVENUE', true, true),
 ('510100', 'Harga Pokok Pembelian Bahan Baku (Raw Material)', 'EXPENSE', true, true),
 ('610100', 'Biaya Perjalanan Dinas & Transportasi', 'EXPENSE', true, true),
 ('610200', 'Biaya Operasional Kantor & Utilitas', 'EXPENSE', true, true),
 ('610300', 'Biaya Pemeliharaan Mesin & Pabrik', 'EXPENSE', true, true),
 ('610400', 'Biaya Jamuan, Rapat & Representasi', 'EXPENSE', true, true)
ON CONFLICT ("AccountCode") DO NOTHING;

INSERT INTO mst_expense_category ("Code","Name","IsActive") VALUES
 ('TRAVEL', 'Perjalanan Dinas, Hotel & Transportasi', true),
 ('OFFICE', 'Keperluan Kantor, ATK & Konsumsi Rapat', true),
 ('MAINT',  'Pemeliharaan Rutin & Perbaikan Darurat', true),
 ('OPER',   'Operasional Pabrik & Logistik Harian', true)
ON CONFLICT ("Code") DO NOTHING;

INSERT INTO mst_transaction_type ("Module","Code","Name","RequiresSettlement","RequiresClose","ControlCoaId","IsActive")
SELECT 'CA', 'CA_OPS', 'Cash Advance Operasional & Pembelian Tunai', true, false, c."Id", true
  FROM mst_coa c WHERE c."AccountCode"='114100'
ON CONFLICT ("Module","Code") DO NOTHING;

INSERT INTO mst_transaction_type ("Module","Code","Name","RequiresSettlement","RequiresClose","ControlCoaId","IsActive")
SELECT 'CA', 'CA_TRV', 'Cash Advance Perjalanan Dinas (Business Trip)', true, false, c."Id", true
  FROM mst_coa c WHERE c."AccountCode"='114100'
ON CONFLICT ("Module","Code") DO NOTHING;

INSERT INTO mst_transaction_type ("Module","Code","Name","RequiresSettlement","RequiresClose","ControlCoaId","IsActive")
SELECT 'RMB', 'RMB_EMP', 'Reimbursement Klaim Biaya Karyawan', false, false, c."Id", true
  FROM mst_coa c WHERE c."AccountCode"='210200'
ON CONFLICT ("Module","Code") DO NOTHING;

INSERT INTO mst_transaction_type ("Module","Code","Name","RequiresSettlement","RequiresClose","ControlCoaId","IsActive")
SELECT 'RMB', 'RMB_OPS', 'Reimbursement Operasional & Petty Cash', false, false, c."Id", true
  FROM mst_coa c WHERE c."AccountCode"='210200'
ON CONFLICT ("Module","Code") DO NOTHING;

INSERT INTO mst_company_bank_account ("Code","AccountKind","AccountNo","AccountName","CurrencyCode","CoaId","IsActive")
SELECT 'MUFG-IDR', 'BANK', '710-0012345-88', 'MUFG Bank Operational Account (IDR)', 'IDR', c."Id", true
  FROM mst_coa c WHERE c."AccountCode"='110100'
ON CONFLICT ("Code") DO NOTHING;

INSERT INTO mst_company_bank_account ("Code","AccountKind","AccountNo","AccountName","CurrencyCode","CoaId","IsActive")
SELECT 'BCA-IDR', 'BANK', '012-3009988-11', 'Bank Central Asia Giro Corporate (IDR)', 'IDR', c."Id", true
  FROM mst_coa c WHERE c."AccountCode"='110100'
ON CONFLICT ("Code") DO NOTHING;

INSERT INTO mst_company_bank_account ("Code","AccountKind","AccountNo","AccountName","CurrencyCode","CoaId","IsActive")
SELECT 'PETTY-IDR', 'CASH', 'CASH-HO-01', 'Kas Kecil (Petty Cash) Head Office', 'IDR', c."Id", true
  FROM mst_coa c WHERE c."AccountCode"='110100'
ON CONFLICT ("Code") DO NOTHING;

-- Ensure admin user has an mst_employee record so CA / RMB can reference EmployeeUserId
INSERT INTO mst_employee ("UserId","EmployeeNo","DepartmentId","JobTitle","JoinDate","IsActive")
SELECT u."Id", 'EMP-0001',
       (SELECT "Id" FROM mst_department WHERE NOT "IsDeleted" ORDER BY "Id" LIMIT 1),
       'Purchasing & Finance Administrator',
       '2025-01-01', true
  FROM mst_user u WHERE u."Email"='admin@purchasing.local'
ON CONFLICT ("UserId") DO NOTHING;

-- 5. Update vw_doc_pr to include PurchaseClassCode (so Purchase Request Raw Material can filter by RAW_MAT)
DROP VIEW IF EXISTS vw_doc_pr;
CREATE VIEW vw_doc_pr AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."DepartmentId", dep."Code" AS "DepartmentCode", dep."Name" AS "DepartmentName",
       pr."RequiredDate", pr."PurchaseClassId", pc."Code" AS "PurchaseClassCode", pc."Name" AS "PurchaseClassName",
       pr."CostCenterId", cc."Code" AS "CostCenterCode", cc."Name" AS "CostCenterName",
       pr."SourcingMethod", pr."Justification",
       d."CurrencyCode", d."TotalAmount", d."TotalAmountBase",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       (SELECT count(*)::int FROM tr_purchase_request_line l WHERE l."PurchaseRequestId" = d."Id") AS "LineCount",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_purchase_request pr
JOIN tr_document d ON d."Id" = pr."DocumentId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_department dep ON dep."Id" = d."DepartmentId"
LEFT JOIN mst_purchase_class pc ON pc."Id" = pr."PurchaseClassId"
LEFT JOIN mst_cost_center cc ON cc."Id" = pr."CostCenterId";

-- 6. Views for CA, STL, RMB, INV, PAY, ARI, RCV
CREATE OR REPLACE VIEW vw_doc_ca AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."DepartmentId", dep."Name" AS "DepartmentName",
       ca."EmployeeUserId", emp."EmployeeNo", COALESCE(eu."DisplayName", ou."DisplayName") AS "EmployeeName",
       ca."TransactionTypeId", tt."Code" AS "TransactionTypeCode", tt."Name" AS "TransactionTypeName",
       ca."Purpose", ca."RequiredDate", ca."SettledAt", ca."ClosedAt",
       d."CurrencyCode", d."TotalAmount", d."TotalAmountBase", d."AppliedAmount",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       (SELECT count(*)::int FROM tr_expense_line l WHERE l."DocumentId" = d."Id") AS "LineCount",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_cash_advance ca
JOIN tr_document d ON d."Id" = ca."DocumentId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_employee emp ON emp."UserId" = ca."EmployeeUserId"
LEFT JOIN mst_user eu ON eu."Id" = ca."EmployeeUserId"
LEFT JOIN mst_transaction_type tt ON tt."Id" = ca."TransactionTypeId"
LEFT JOIN mst_department dep ON dep."Id" = d."DepartmentId";

CREATE OR REPLACE VIEW vw_doc_stl AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."DepartmentId", dep."Name" AS "DepartmentName",
       stl."CashAdvanceId", cad."PublicId" AS "CaPublicId", cad."DocNo" AS "CaDocNo", cad."Title" AS "CaTitle",
       stl."Purpose", stl."ReferenceNo", stl."AdvanceAmount", stl."SpentAmount", stl."DifferenceAmount",
       d."CurrencyCode", d."TotalAmount", d."TotalAmountBase",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       (SELECT count(*)::int FROM tr_expense_line l WHERE l."DocumentId" = d."Id") AS "LineCount",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_settlement stl
JOIN tr_document d ON d."Id" = stl."DocumentId"
JOIN tr_document cad ON cad."Id" = stl."CashAdvanceId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_department dep ON dep."Id" = d."DepartmentId";

CREATE OR REPLACE VIEW vw_doc_rmb AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."DepartmentId", dep."Name" AS "DepartmentName",
       rmb."PayeeType", rmb."EmployeeUserId", emp."EmployeeNo", COALESCE(eu."DisplayName", ou."DisplayName") AS "EmployeeName",
       d."BpId", bp."PublicId" AS "BpPublicId", bp."BpCode", bp."LegalName" AS "BpName",
       rmb."TransactionTypeId", tt."Code" AS "TransactionTypeCode", tt."Name" AS "TransactionTypeName",
       rmb."ReferenceNo",
       d."CurrencyCode", d."TotalAmount", d."TotalAmountBase", d."AppliedAmount",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       (SELECT count(*)::int FROM tr_expense_line l WHERE l."DocumentId" = d."Id") AS "LineCount",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_reimbursement rmb
JOIN tr_document d ON d."Id" = rmb."DocumentId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_employee emp ON emp."UserId" = rmb."EmployeeUserId"
LEFT JOIN mst_user eu ON eu."Id" = rmb."EmployeeUserId"
LEFT JOIN mst_business_partner bp ON bp."Id" = d."BpId"
LEFT JOIN mst_transaction_type tt ON tt."Id" = rmb."TransactionTypeId"
LEFT JOIN mst_department dep ON dep."Id" = d."DepartmentId";

CREATE OR REPLACE VIEW vw_doc_inv AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."BpId", bp."PublicId" AS "BpPublicId", bp."BpCode", bp."LegalName" AS "BpName",
       inv."InvoiceKind", inv."PurchaseOrderId", pod."PublicId" AS "PoPublicId", pod."DocNo" AS "PoDocNo",
       inv."BpInvoiceNo", inv."TaxInvoiceNo", inv."InvoiceDate", inv."ReceivedDate", inv."DueDate",
       inv."TransactionAmount", inv."DownPaymentAmount", inv."TaxBaseAmount", inv."VatAmount", inv."WhtAmount", inv."NetPayable",
       d."CurrencyCode", d."TotalAmount", d."TotalAmountBase", d."AppliedAmount",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       (SELECT count(*)::int FROM tr_ap_invoice_line l WHERE l."InvoiceId" = d."Id") AS "LineCount",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_ap_invoice inv
JOIN tr_document d ON d."Id" = inv."DocumentId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_business_partner bp ON bp."Id" = inv."BpId"
LEFT JOIN tr_document pod ON pod."Id" = inv."PurchaseOrderId";

CREATE OR REPLACE VIEW vw_doc_pay AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."BpId", bp."PublicId" AS "BpPublicId", bp."BpCode", bp."LegalName" AS "BpName",
       pay."Purpose", pay."PayeeType", pay."PaymentMethod",
       pay."CompanyBankAccountId", cba."Code" AS "CompanyBankCode", cba."AccountName" AS "CompanyBankName",
       pay."PlannedDate", pay."PaidDate", pay."BankBatchNo", pay."BankReference",
       (SELECT td."DocNo" FROM tr_payment_allocation pa JOIN tr_document td ON td."Id" = pa."TargetDocumentId" WHERE pa."PaymentId" = d."Id" LIMIT 1) AS "TargetDocNo",
       (SELECT td."PublicId" FROM tr_payment_allocation pa JOIN tr_document td ON td."Id" = pa."TargetDocumentId" WHERE pa."PaymentId" = d."Id" LIMIT 1) AS "TargetDocPublicId",
       d."CurrencyCode", d."TotalAmount", d."TotalAmountBase",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       (SELECT count(*)::int FROM tr_payment_allocation pa WHERE pa."PaymentId" = d."Id") AS "AllocationCount",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_payment pay
JOIN tr_document d ON d."Id" = pay."DocumentId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_business_partner bp ON bp."Id" = d."BpId"
LEFT JOIN mst_company_bank_account cba ON cba."Id" = pay."CompanyBankAccountId";

CREATE OR REPLACE VIEW vw_doc_ari AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."BpId", bp."PublicId" AS "BpPublicId", bp."BpCode", bp."LegalName" AS "BpName",
       ari."InvoiceKind", ari."CustomerPoNo", ari."CommercialInvoiceNo", ari."TaxInvoiceNo",
       ari."InvoiceDate", ari."DueDate",
       ari."SubtotalAmount", ari."DiscountAmount", ari."VatAmount", ari."WhtAmount", ari."NetReceivable",
       d."CurrencyCode", d."TotalAmount", d."TotalAmountBase", d."AppliedAmount",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       (SELECT count(*)::int FROM tr_ar_invoice_line l WHERE l."InvoiceId" = d."Id") AS "LineCount",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_ar_invoice ari
JOIN tr_document d ON d."Id" = ari."DocumentId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_business_partner bp ON bp."Id" = d."BpId";

-- 7. Default Approval Templates for New DocTypes (so Submit for Approval works out of the box)
DO $$
DECLARE
  v_admin_id bigint;
  v_tpl_id int;
  v_dt text;
BEGIN
  SELECT "Id" INTO v_admin_id FROM mst_user WHERE "Email" = 'admin@purchasing.local' LIMIT 1;
  IF v_admin_id IS NULL THEN
    SELECT "Id" INTO v_admin_id FROM mst_user ORDER BY "Id" LIMIT 1;
  END IF;

  FOREACH v_dt IN ARRAY ARRAY['CA','STL','RMB','INV','PAY','ARI'] LOOP
    IF NOT EXISTS (SELECT 1 FROM mst_approval_template WHERE "DocType" = v_dt AND NOT "IsDeleted") THEN
      INSERT INTO mst_approval_template ("Code","Name","DocType","Priority","MinAmountBase","EffectiveFrom","IsActive","CreatedBy")
      VALUES ('TPL-' || v_dt || '-STD', 'Alur Persetujuan Standar ' || v_dt, v_dt, 1, 0, '2025-01-01', true, v_admin_id)
      RETURNING "Id" INTO v_tpl_id;

      INSERT INTO mst_approval_template_step ("TemplateId","StepNo","Name","ApproverType","ApproverRoleId","RequiredApprovals")
      SELECT v_tpl_id, 1, 'Finance & Management Approval', 'ROLE', r."Id", 1
        FROM mst_role r WHERE r."Code" = 'ADMIN' LIMIT 1;
    END IF;
  END LOOP;
END $$;
