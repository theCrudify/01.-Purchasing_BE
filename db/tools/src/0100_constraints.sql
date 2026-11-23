/* =====================================================================
   Purchasing Portal db-port 0100 — session helpers, CHECK constraints, partial unique indexes, read views.
   Port of KPIN_DB_REDESIGN/prisma/sql/constraints.sql (SQL Server). Idempotent.
   Template: db/tools/src/0100_constraints.sql (bare PascalCase columns) -> db/tools/build.py.
   ===================================================================== */

/* ---------------------------------------------------------------------
   0. Session helpers (SESSION_CONTEXT -> set_config('purchasing.*', v, true) by apps/api/src/core/db.ts)
   --------------------------------------------------------------------- */

-- role the statement runs as, also inside SECURITY DEFINER functions (the `role` GUC keeps the
-- caller's SET LOCAL ROLE; 'none' = no SET ROLE, i.e. the login itself)
CREATE OR REPLACE FUNCTION purchasing_outer_role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN current_setting('role') = 'none' THEN session_user::text ELSE current_setting('role') END
$$;

-- logged-in user (TRY_CAST semantics: anything that is not a number counts as missing)
CREATE OR REPLACE FUNCTION purchasing_actor() RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN current_setting('purchasing.user_id', true) ~ '^[0-9]{1,18}$' THEN current_setting('purchasing.user_id', true)::bigint END
$$;

-- portal (business partner) actor: context says BP, or the statement runs as purchasing_portal
CREATE OR REPLACE FUNCTION purchasing_is_bp() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('purchasing.user_type', true), '') = 'BP' OR purchasing_outer_role() = 'purchasing_portal'
$$;

-- maintenance bypass (purchasing.recalc set): honoured only for the database owner / superuser, never when
-- the statement runs as purchasing_app / purchasing_portal (original: IS_MEMBER('db_owner'))
CREATE OR REPLACE FUNCTION purchasing_bypass() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('purchasing.recalc', true), '') NOT IN ('', '0')
     AND purchasing_outer_role() NOT IN ('purchasing_app', 'purchasing_portal')
     AND pg_has_role(purchasing_outer_role(), (SELECT c.relowner FROM pg_class c WHERE c.oid = 'public.tr_document'::regclass), 'USAGE')
$$;

/* ---------------------------------------------------------------------
   1. CHECK constraints (drop + add: re-running replaces the definition)
   --------------------------------------------------------------------- */

-- identity
ALTER TABLE mst_user DROP CONSTRAINT IF EXISTS ck_mst_user_usertype, ADD CONSTRAINT ck_mst_user_usertype CHECK (UserType IN ('INTERNAL','BP','SYSTEM'));
ALTER TABLE mst_user DROP CONSTRAINT IF EXISTS ck_mst_user_status, ADD CONSTRAINT ck_mst_user_status CHECK (Status IN ('PENDING_ACTIVATION','ACTIVE','LOCKED','DISABLED','REJECTED'));
ALTER TABLE mst_user DROP CONSTRAINT IF EXISTS ck_mst_user_rejected, ADD CONSTRAINT ck_mst_user_rejected CHECK (Status <> 'REJECTED' OR StatusReason IS NOT NULL);
-- local login needs a password; SSO users get ExternalAuthId bound on first login
ALTER TABLE sys_user_credential DROP CONSTRAINT IF EXISTS ck_sys_user_credential_provider, ADD CONSTRAINT ck_sys_user_credential_provider CHECK (AuthProvider IN ('LOCAL','ENTRA_ID'));
ALTER TABLE sys_user_credential DROP CONSTRAINT IF EXISTS ck_sys_user_credential_local, ADD CONSTRAINT ck_sys_user_credential_local CHECK (AuthProvider <> 'LOCAL' OR PasswordHash IS NOT NULL);
ALTER TABLE sys_user_credential DROP CONSTRAINT IF EXISTS ck_sys_user_credential_counters, ADD CONSTRAINT ck_sys_user_credential_counters CHECK (FailedLoginCount >= 0 AND LockoutCount BETWEEN 0 AND 10);
ALTER TABLE mst_role DROP CONSTRAINT IF EXISTS ck_mst_role_scope, ADD CONSTRAINT ck_mst_role_scope CHECK (Scope IN ('INTERNAL','BP','SYSTEM'));
-- organisation
ALTER TABLE mst_department DROP CONSTRAINT IF EXISTS ck_mst_department_notselfparent, ADD CONSTRAINT ck_mst_department_notselfparent CHECK (ParentId IS NULL OR ParentId <> Id);
ALTER TABLE mst_employee DROP CONSTRAINT IF EXISTS ck_mst_employee_usertype, ADD CONSTRAINT ck_mst_employee_usertype CHECK (UserType = 'INTERNAL');
ALTER TABLE mst_employee DROP CONSTRAINT IF EXISTS ck_mst_employee_notownsuperior, ADD CONSTRAINT ck_mst_employee_notownsuperior CHECK (SuperiorUserId IS NULL OR SuperiorUserId <> UserId);
ALTER TABLE mst_employee DROP CONSTRAINT IF EXISTS ck_mst_employee_endreason, ADD CONSTRAINT ck_mst_employee_endreason CHECK (EndReason IS NULL OR EndReason IN ('RESIGNED','TERMINATED','RETIRED','TRANSFERRED','DECEASED'));
ALTER TABLE mst_employee DROP CONSTRAINT IF EXISTS ck_mst_employee_endpair, ADD CONSTRAINT ck_mst_employee_endpair CHECK ((EndDate IS NULL AND EndReason IS NULL) OR (EndDate IS NOT NULL AND EndReason IS NOT NULL));
ALTER TABLE mst_employee DROP CONSTRAINT IF EXISTS ck_mst_employee_period, ADD CONSTRAINT ck_mst_employee_period CHECK (EndDate IS NULL OR JoinDate IS NULL OR EndDate >= JoinDate);
-- finance master
ALTER TABLE mst_coa DROP CONSTRAINT IF EXISTS ck_mst_coa_type, ADD CONSTRAINT ck_mst_coa_type CHECK (AccountType IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'));
ALTER TABLE mst_coa DROP CONSTRAINT IF EXISTS ck_mst_coa_notselfparent, ADD CONSTRAINT ck_mst_coa_notselfparent CHECK (ParentId IS NULL OR ParentId <> Id);
ALTER TABLE mst_transaction_type DROP CONSTRAINT IF EXISTS ck_mst_transaction_type_module, ADD CONSTRAINT ck_mst_transaction_type_module CHECK (Module IN ('CA','STL','RMB','ALL'));
ALTER TABLE mst_expense_account DROP CONSTRAINT IF EXISTS ck_mst_expense_account_module, ADD CONSTRAINT ck_mst_expense_account_module CHECK (Module IN ('CA','STL','RMB','AP','ALL'));
ALTER TABLE mst_purchase_class DROP CONSTRAINT IF EXISTS ck_mst_purchase_class_tolerance, ADD CONSTRAINT ck_mst_purchase_class_tolerance CHECK (InvoicePriceTolerancePct BETWEEN 0 AND 100);
-- document amounts are stored with 2 decimals; a currency with more minor units cannot be used
ALTER TABLE mst_currency DROP CONSTRAINT IF EXISTS ck_mst_currency_usabledecimals, ADD CONSTRAINT ck_mst_currency_usabledecimals CHECK (IsActive = false OR Decimals <= 2);
ALTER TABLE mst_budget DROP CONSTRAINT IF EXISTS ck_mst_budget_mode, ADD CONSTRAINT ck_mst_budget_mode CHECK (ControlMode IN ('BLOCK','WARN'));
ALTER TABLE mst_budget DROP CONSTRAINT IF EXISTS ck_mst_budget_values, ADD CONSTRAINT ck_mst_budget_values CHECK (Amount >= 0 AND FiscalYear BETWEEN 2000 AND 2100);
ALTER TABLE mst_posting_period DROP CONSTRAINT IF EXISTS ck_mst_posting_period_key, ADD CONSTRAINT ck_mst_posting_period_key CHECK (PeriodKey ~ '^20[0-9]{2}(0[1-9]|1[0-2])$');
ALTER TABLE mst_posting_period DROP CONSTRAINT IF EXISTS ck_mst_posting_period_status, ADD CONSTRAINT ck_mst_posting_period_status CHECK (Status IN ('OPEN','CLOSING','LOCKED'));
ALTER TABLE mst_posting_period DROP CONSTRAINT IF EXISTS ck_mst_posting_period_locked, ADD CONSTRAINT ck_mst_posting_period_locked CHECK (Status <> 'LOCKED' OR (ClosedAt IS NOT NULL AND ClosedBy IS NOT NULL));
-- a filter is only meaningful for the roles that are looked up with it
ALTER TABLE mst_account_determination DROP CONSTRAINT IF EXISTS ck_mst_account_determination_role, ADD CONSTRAINT ck_mst_account_determination_role CHECK (AccountRole IN ('GRIR_CLEARING','INVENTORY','EXPENSE','FIXED_ASSET','REVENUE',
      'VAT_INPUT','VAT_OUTPUT','WHT_PAYABLE','WHT_PREPAID','AP_CONTROL','AR_CONTROL','DOWN_PAYMENT_AP','DOWN_PAYMENT_AR',
      'EMPLOYEE_ADVANCE','CASH_DISCOUNT','FX_GAIN_REALIZED','FX_LOSS_REALIZED','FX_GAIN_UNREALIZED','FX_LOSS_UNREALIZED','ROUNDING'));
ALTER TABLE mst_account_determination DROP CONSTRAINT IF EXISTS ck_mst_account_determination_taxfilter, ADD CONSTRAINT ck_mst_account_determination_taxfilter CHECK (TaxCodeId IS NULL OR AccountRole IN ('VAT_INPUT','VAT_OUTPUT','WHT_PAYABLE','WHT_PREPAID'));
ALTER TABLE mst_account_determination DROP CONSTRAINT IF EXISTS ck_mst_account_determination_itemfilter, ADD CONSTRAINT ck_mst_account_determination_itemfilter CHECK ((CategoryId IS NULL AND PurchaseClassId IS NULL)
                                                         OR AccountRole IN ('GRIR_CLEARING','INVENTORY','EXPENSE','FIXED_ASSET','REVENUE'));
ALTER TABLE mst_company_bank_account DROP CONSTRAINT IF EXISTS ck_mst_company_bank_account_kind, ADD CONSTRAINT ck_mst_company_bank_account_kind CHECK ((AccountKind = 'BANK' AND BankId IS NOT NULL AND AccountNo IS NOT NULL)
                                                  OR (AccountKind = 'CASH' AND BankId IS NULL AND AccountNo IS NULL));
ALTER TABLE mst_employee_bank_account DROP CONSTRAINT IF EXISTS ck_mst_employee_bank_account_makerchecker, ADD CONSTRAINT ck_mst_employee_bank_account_makerchecker CHECK (VerifiedBy IS NULL OR CreatedBy IS NULL OR VerifiedBy <> CreatedBy);
ALTER TABLE mst_employee_bank_account DROP CONSTRAINT IF EXISTS ck_mst_employee_bank_account_status, ADD CONSTRAINT ck_mst_employee_bank_account_status CHECK (VerificationStatus IN ('PENDING','VERIFIED','REJECTED'));
ALTER TABLE mst_employee_bank_account DROP CONSTRAINT IF EXISTS ck_mst_employee_bank_account_primaryverified, ADD CONSTRAINT ck_mst_employee_bank_account_primaryverified CHECK (IsPrimary = false OR VerificationStatus = 'VERIFIED');
ALTER TABLE mst_approver_mapping DROP CONSTRAINT IF EXISTS ck_mst_approver_mapping_stepcode, ADD CONSTRAINT ck_mst_approver_mapping_stepcode CHECK (StepCode IN ('CH','AC','AP','RE','CL'));
ALTER TABLE mst_approver_mapping DROP CONSTRAINT IF EXISTS ck_mst_approver_mapping_doctype, ADD CONSTRAINT ck_mst_approver_mapping_doctype CHECK (DocType IN ('PR','PO','CTR','CA','STL','RMB','ARI','INV','PAY'));
ALTER TABLE mst_approver_mapping DROP CONSTRAINT IF EXISTS ck_mst_approver_mapping_purpose, ADD CONSTRAINT ck_mst_approver_mapping_purpose CHECK (PaymentPurpose IS NULL OR (DocType = 'PAY' AND PaymentPurpose IN ('AP_INVOICE','CASH_ADVANCE','REIMBURSEMENT','SETTLEMENT_TOPUP')));
ALTER TABLE mst_approver_mapping DROP CONSTRAINT IF EXISTS ck_mst_approver_mapping_notself, ADD CONSTRAINT ck_mst_approver_mapping_notself CHECK (PreparerUserId <> ApproverUserId);
-- general master
ALTER TABLE mst_exchange_rate DROP CONSTRAINT IF EXISTS ck_mst_exchange_rate_positive, ADD CONSTRAINT ck_mst_exchange_rate_positive CHECK (RateToBase > 0);
ALTER TABLE mst_exchange_rate DROP CONSTRAINT IF EXISTS ck_mst_exchange_rate_type, ADD CONSTRAINT ck_mst_exchange_rate_type CHECK (RateType IN ('MIDDLE','TAX','BANK'));
ALTER TABLE mst_exchange_rate DROP CONSTRAINT IF EXISTS ck_mst_exchange_rate_source, ADD CONSTRAINT ck_mst_exchange_rate_source CHECK (Source IN ('BI','KMK','BANK','MANUAL'));
ALTER TABLE mst_exchange_rate DROP CONSTRAINT IF EXISTS ck_mst_exchange_rate_notbase, ADD CONSTRAINT ck_mst_exchange_rate_notbase CHECK (CurrencyCode <> 'IDR');
ALTER TABLE mst_tax_code DROP CONSTRAINT IF EXISTS ck_mst_tax_code_type, ADD CONSTRAINT ck_mst_tax_code_type CHECK (TaxType IN ('VAT','WHT'));
ALTER TABLE mst_tax_code DROP CONSTRAINT IF EXISTS ck_mst_tax_code_rate, ADD CONSTRAINT ck_mst_tax_code_rate CHECK (RatePercent BETWEEN 0 AND 100);
ALTER TABLE mst_tax_code DROP CONSTRAINT IF EXISTS ck_mst_tax_code_period, ADD CONSTRAINT ck_mst_tax_code_period CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom);
ALTER TABLE mst_payment_term DROP CONSTRAINT IF EXISTS ck_mst_payment_term_duedays, ADD CONSTRAINT ck_mst_payment_term_duedays CHECK (DueDays >= 0);
ALTER TABLE mst_payment_term DROP CONSTRAINT IF EXISTS ck_mst_payment_term_baseline, ADD CONSTRAINT ck_mst_payment_term_baseline CHECK (BaselineDate IN ('INVOICE_DATE','RECEIPT_DATE'));
ALTER TABLE mst_category DROP CONSTRAINT IF EXISTS ck_mst_category_notselfparent, ADD CONSTRAINT ck_mst_category_notselfparent CHECK (ParentId IS NULL OR ParentId <> Id);
ALTER TABLE mst_item DROP CONSTRAINT IF EXISTS ck_mst_item_type, ADD CONSTRAINT ck_mst_item_type CHECK (ItemType IN ('GOODS','SERVICE'));
ALTER TABLE mst_bp_document_type DROP CONSTRAINT IF EXISTS ck_mst_bp_document_type_appliesto, ADD CONSTRAINT ck_mst_bp_document_type_appliesto CHECK (AppliesTo IN ('ALL','COMPANY','INDIVIDUAL'));
-- business partner
-- migrated vendors may lack a valid NPWP until cleaned up (see vw_bp_data_quality)
-- e.g. outsourced drivers paid via CA / reimbursement
ALTER TABLE mst_business_partner DROP CONSTRAINT IF EXISTS ck_mst_bp_role, ADD CONSTRAINT ck_mst_bp_role CHECK (IsSupplier = true OR IsCustomer = true);
ALTER TABLE mst_business_partner DROP CONSTRAINT IF EXISTS ck_mst_bp_entitytype, ADD CONSTRAINT ck_mst_bp_entitytype CHECK (EntityType IN ('COMPANY','INDIVIDUAL'));
ALTER TABLE mst_business_partner DROP CONSTRAINT IF EXISTS ck_mst_bp_onboarding, ADD CONSTRAINT ck_mst_bp_onboarding CHECK (OnboardingStatus IN ('DRAFT','SUBMITTED','REVISION_REQUIRED','APPROVED','REJECTED'));
ALTER TABLE mst_business_partner DROP CONSTRAINT IF EXISTS ck_mst_bp_operational, ADD CONSTRAINT ck_mst_bp_operational CHECK (OperationalStatus IN ('INACTIVE','ACTIVE','SUSPENDED','BLACKLISTED'));
ALTER TABLE mst_business_partner DROP CONSTRAINT IF EXISTS ck_mst_bp_source, ADD CONSTRAINT ck_mst_bp_source CHECK (Source IN ('SELF_REGISTERED','INTERNAL','MIGRATED'));
ALTER TABLE mst_business_partner DROP CONSTRAINT IF EXISTS ck_mst_bp_activeneedsapproval, ADD CONSTRAINT ck_mst_bp_activeneedsapproval CHECK (OperationalStatus <> 'ACTIVE' OR OnboardingStatus = 'APPROVED');
ALTER TABLE mst_business_partner DROP CONSTRAINT IF EXISTS ck_mst_bp_taxidrequired, ADD CONSTRAINT ck_mst_bp_taxidrequired CHECK (OnboardingStatus = 'DRAFT' OR CountryCode <> 'ID' OR TaxId IS NOT NULL OR Source = 'MIGRATED'
                                          OR (EntityType = 'INDIVIDUAL' AND Source = 'INTERNAL'));
ALTER TABLE mst_business_partner DROP CONSTRAINT IF EXISTS ck_mst_bp_email, ADD CONSTRAINT ck_mst_bp_email CHECK (Source <> 'SELF_REGISTERED' OR Email IS NOT NULL);
ALTER TABLE mst_business_partner DROP CONSTRAINT IF EXISTS ck_mst_bp_taxiddigits, ADD CONSTRAINT ck_mst_bp_taxiddigits CHECK (TaxId IS NULL OR TaxId !~ '[^0-9]');
ALTER TABLE mst_business_partner DROP CONSTRAINT IF EXISTS ck_mst_bp_codeonapproval, ADD CONSTRAINT ck_mst_bp_codeonapproval CHECK (OnboardingStatus <> 'APPROVED' OR BpCode IS NOT NULL);
ALTER TABLE mst_bp_bank_account DROP CONSTRAINT IF EXISTS ck_mst_bp_bank_account_makerchecker, ADD CONSTRAINT ck_mst_bp_bank_account_makerchecker CHECK (VerifiedBy IS NULL OR CreatedBy IS NULL OR VerifiedBy <> CreatedBy);
ALTER TABLE mst_bp_bank_account DROP CONSTRAINT IF EXISTS ck_mst_bp_bank_account_beneficiarytype, ADD CONSTRAINT ck_mst_bp_bank_account_beneficiarytype CHECK (BeneficiaryType IS NULL OR BeneficiaryType IN ('INDIVIDUAL','COMPANY'));
ALTER TABLE mst_bp_address DROP CONSTRAINT IF EXISTS ck_mst_bp_address_type, ADD CONSTRAINT ck_mst_bp_address_type CHECK (AddressType IN ('HQ','BILLING','SHIPPING','BRANCH'));
ALTER TABLE mst_bp_contact DROP CONSTRAINT IF EXISTS ck_mst_bp_contact_reachable, ADD CONSTRAINT ck_mst_bp_contact_reachable CHECK (Email IS NOT NULL OR Phone IS NOT NULL);
ALTER TABLE mst_bp_bank_account DROP CONSTRAINT IF EXISTS ck_mst_bp_bank_account_status, ADD CONSTRAINT ck_mst_bp_bank_account_status CHECK (VerificationStatus IN ('PENDING','VERIFIED','REJECTED'));
ALTER TABLE mst_bp_bank_account DROP CONSTRAINT IF EXISTS ck_mst_bp_bank_account_primaryverified, ADD CONSTRAINT ck_mst_bp_bank_account_primaryverified CHECK (IsPrimary = false OR VerificationStatus = 'VERIFIED');
ALTER TABLE mst_bp_bank_account DROP CONSTRAINT IF EXISTS ck_mst_bp_bank_account_verifiedstamp, ADD CONSTRAINT ck_mst_bp_bank_account_verifiedstamp CHECK (VerificationStatus = 'PENDING' OR (VerifiedAt IS NOT NULL AND VerifiedBy IS NOT NULL));
ALTER TABLE mst_bp_category DROP CONSTRAINT IF EXISTS ck_mst_bp_category_status, ADD CONSTRAINT ck_mst_bp_category_status CHECK (Status IN ('PENDING','APPROVED','REJECTED','SUSPENDED'));
ALTER TABLE mst_bp_user DROP CONSTRAINT IF EXISTS ck_mst_bp_user_usertype, ADD CONSTRAINT ck_mst_bp_user_usertype CHECK (UserType = 'BP');
ALTER TABLE mst_bp_user DROP CONSTRAINT IF EXISTS ck_mst_bp_user_accessrole, ADD CONSTRAINT ck_mst_bp_user_accessrole CHECK (AccessRole IN ('ADMIN','STAFF'));
ALTER TABLE mst_bp_internal_pic DROP CONSTRAINT IF EXISTS ck_mst_bp_internal_pic_usertype, ADD CONSTRAINT ck_mst_bp_internal_pic_usertype CHECK (UserType = 'INTERNAL');
ALTER TABLE mst_bp_internal_pic DROP CONSTRAINT IF EXISTS ck_mst_bp_internal_pic_role, ADD CONSTRAINT ck_mst_bp_internal_pic_role CHECK (PicRole IN ('BUYER','INVOICE_RECEIVER','ACCOUNT_MANAGER'));
ALTER TABLE mst_bp_document DROP CONSTRAINT IF EXISTS ck_mst_bp_document_status, ADD CONSTRAINT ck_mst_bp_document_status CHECK (Status IN ('PENDING_REVIEW','ACCEPTED','REJECTED','SUPERSEDED','EXPIRED'));
ALTER TABLE mst_bp_document DROP CONSTRAINT IF EXISTS ck_mst_bp_document_dates, ADD CONSTRAINT ck_mst_bp_document_dates CHECK (ExpiryDate IS NULL OR IssuedDate IS NULL OR ExpiryDate > IssuedDate);
ALTER TABLE mst_bp_document DROP CONSTRAINT IF EXISTS ck_mst_bp_document_removed, ADD CONSTRAINT ck_mst_bp_document_removed CHECK ((RemovedAt IS NULL AND RemovedBy IS NULL) OR (RemovedAt IS NOT NULL AND RemovedBy IS NOT NULL));
ALTER TABLE mst_bp_document DROP CONSTRAINT IF EXISTS ck_mst_bp_document_reviewed, ADD CONSTRAINT ck_mst_bp_document_reviewed CHECK (Status IN ('PENDING_REVIEW','SUPERSEDED','EXPIRED') OR (ReviewedBy IS NOT NULL AND ReviewedAt IS NOT NULL));
-- approval configuration
ALTER TABLE mst_approval_template DROP CONSTRAINT IF EXISTS ck_mst_approval_template_doctype, ADD CONSTRAINT ck_mst_approval_template_doctype CHECK (DocType IN ('SVR','PR','RFQ','PO','CTR','INV','PAY','CA','STL','RMB','ARI'));
ALTER TABLE mst_approval_template DROP CONSTRAINT IF EXISTS ck_mst_approval_template_purpose, ADD CONSTRAINT ck_mst_approval_template_purpose CHECK (PaymentPurpose IS NULL OR (DocType = 'PAY' AND PaymentPurpose IN ('AP_INVOICE','CASH_ADVANCE','REIMBURSEMENT','SETTLEMENT_TOPUP')));
ALTER TABLE mst_approval_template DROP CONSTRAINT IF EXISTS ck_mst_approval_template_range, ADD CONSTRAINT ck_mst_approval_template_range CHECK (MinAmountBase IS NULL OR MaxAmountBase IS NULL OR MaxAmountBase > MinAmountBase);
ALTER TABLE mst_approval_template DROP CONSTRAINT IF EXISTS ck_mst_approval_template_period, ADD CONSTRAINT ck_mst_approval_template_period CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom);
ALTER TABLE mst_approval_template_step DROP CONSTRAINT IF EXISTS ck_mst_approval_step_type, ADD CONSTRAINT ck_mst_approval_step_type CHECK (ApproverType IN ('USER','ROLE','REQUESTER_PICK','PREPARER_MAPPING','PREPARER_MAPPING_PICK','SUPERIOR','DEPARTMENT_HEAD','BP_PIC'));
ALTER TABLE mst_approval_template_step DROP CONSTRAINT IF EXISTS ck_mst_approval_step_code, ADD CONSTRAINT ck_mst_approval_step_code CHECK (StepCode IS NULL OR StepCode IN ('CH','AC','AP','RE','CL'));
ALTER TABLE mst_approval_template_step DROP CONSTRAINT IF EXISTS ck_mst_approval_step_mappingneedscode, ADD CONSTRAINT ck_mst_approval_step_mappingneedscode CHECK (ApproverType NOT IN ('PREPARER_MAPPING','PREPARER_MAPPING_PICK') OR StepCode IS NOT NULL);
ALTER TABLE mst_approval_template_step DROP CONSTRAINT IF EXISTS ck_mst_approval_step_picrole, ADD CONSTRAINT ck_mst_approval_step_picrole CHECK ((ApproverType = 'BP_PIC' AND PicRole IN ('BUYER','INVOICE_RECEIVER','ACCOUNT_MANAGER'))
                                              OR (ApproverType <> 'BP_PIC' AND PicRole IS NULL));
ALTER TABLE mst_approval_template_step DROP CONSTRAINT IF EXISTS ck_mst_approval_step_target, ADD CONSTRAINT ck_mst_approval_step_target CHECK (
        (ApproverType = 'USER' AND ApproverUserId IS NOT NULL AND ApproverRoleId IS NULL)
     OR (ApproverType IN ('ROLE','REQUESTER_PICK') AND ApproverRoleId IS NOT NULL AND ApproverUserId IS NULL)
     OR (ApproverType IN ('PREPARER_MAPPING','PREPARER_MAPPING_PICK','SUPERIOR','DEPARTMENT_HEAD','BP_PIC') AND ApproverUserId IS NULL AND ApproverRoleId IS NULL));
ALTER TABLE mst_approval_template_step DROP CONSTRAINT IF EXISTS ck_mst_approval_step_required, ADD CONSTRAINT ck_mst_approval_step_required CHECK (RequiredApprovals >= 1);
ALTER TABLE mst_approval_delegation DROP CONSTRAINT IF EXISTS ck_mst_approval_delegation_users, ADD CONSTRAINT ck_mst_approval_delegation_users CHECK (FromUserId <> ToUserId);
ALTER TABLE mst_approval_delegation DROP CONSTRAINT IF EXISTS ck_mst_approval_delegation_period, ADD CONSTRAINT ck_mst_approval_delegation_period CHECK (EndsAt > StartsAt);
-- document core
-- drafts may be unnumbered
-- soft delete only for documents no longer in a live process; reason and actor always recorded
-- BP mandatory for supplier/customer documents; optional where the counterparty may be an employee
-- amount-bearing documents carry a currency; totals may be transiently negative only while DRAFT
-- exchange rate: positive, IDR = 1, mandatory once the document leaves DRAFT
-- no over-payment / over-disbursement / over-collection
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_docno, ADD CONSTRAINT ck_tr_document_docno CHECK (Status = 'DRAFT' OR DocNo IS NOT NULL);
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_softdelete, ADD CONSTRAINT ck_tr_document_softdelete CHECK (
        (IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL AND DeleteReason IS NULL)
     OR (IsDeleted = true AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL AND DeleteReason IS NOT NULL
         AND Status IN ('DRAFT','CANCELLED','REJECTED','WITHDRAWN','SUPERSEDED','NOT_AWARDED')));
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_type, ADD CONSTRAINT ck_tr_document_type CHECK (DocType IN ('SVR','PR','RFQ','QUO','PO','CTR','GR','INV','PAY','CA','STL','RMB','ARI','RCV'));
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_bprequired, ADD CONSTRAINT ck_tr_document_bprequired CHECK (DocType NOT IN ('SVR','QUO','PO','CTR','GR','INV','ARI') OR BpId IS NOT NULL);
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_nobp, ADD CONSTRAINT ck_tr_document_nobp CHECK (DocType NOT IN ('PR','RFQ') OR BpId IS NULL);
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_currency, ADD CONSTRAINT ck_tr_document_currency CHECK (DocType IN ('SVR','RFQ','GR') OR CurrencyCode IS NOT NULL);
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_amounts, ADD CONSTRAINT ck_tr_document_amounts CHECK (Status = 'DRAFT' OR TotalAmount IS NULL OR TotalAmount >= 0);
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_rate, ADD CONSTRAINT ck_tr_document_rate CHECK (ExchangeRate IS NULL OR ExchangeRate > 0);
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_idrrate, ADD CONSTRAINT ck_tr_document_idrrate CHECK (CurrencyCode <> 'IDR' OR ExchangeRate IS NULL OR ExchangeRate = 1);
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_raterequired, ADD CONSTRAINT ck_tr_document_raterequired CHECK (Status = 'DRAFT' OR CurrencyCode IS NULL OR ExchangeRate IS NOT NULL);
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_applied, ADD CONSTRAINT ck_tr_document_applied CHECK (AppliedAmount >= 0 AND (DocType NOT IN ('INV','ARI','RMB','CA') OR AppliedAmount <= COALESCE(TotalAmount, 0)));
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_cancel, ADD CONSTRAINT ck_tr_document_cancel CHECK ((Status = 'CANCELLED' AND CancelledAt IS NOT NULL) OR (Status <> 'CANCELLED' AND CancelledAt IS NULL));
ALTER TABLE tr_document DROP CONSTRAINT IF EXISTS ck_tr_document_status, ADD CONSTRAINT ck_tr_document_status CHECK (
        (DocType = 'SVR' AND Status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','REVISION_REQUIRED','PENDING_APPROVAL','APPROVED','REJECTED','CANCELLED'))
     OR (DocType = 'PR'  AND Status IN ('DRAFT','PENDING_APPROVAL','RETURNED','APPROVED','REJECTED','CLOSED','CANCELLED'))
     OR (DocType = 'RFQ' AND Status IN ('DRAFT','PUBLISHED','CLOSED','UNDER_EVALUATION','PENDING_APPROVAL','AWARDED','CANCELLED'))
     OR (DocType = 'QUO' AND Status IN ('DRAFT','SUBMITTED','WITHDRAWN','SUPERSEDED','AWARDED','NOT_AWARDED'))
     OR (DocType = 'PO'  AND Status IN ('DRAFT','PENDING_APPROVAL','RETURNED','APPROVED','REJECTED','ISSUED','ACKNOWLEDGED','PARTIALLY_RECEIVED','RECEIVED','CLOSED','CANCELLED'))
     OR (DocType = 'CTR' AND Status IN ('DRAFT','PENDING_APPROVAL','RETURNED','APPROVED','REJECTED','CLOSED','CANCELLED'))
     OR (DocType = 'GR'  AND Status IN ('DRAFT','POSTED','CANCELLED'))
     OR (DocType = 'INV' AND Status IN ('DRAFT','SUBMITTED','PENDING_APPROVAL','RETURNED','REJECTED','APPROVED','PAYMENT_PROCESSING','PARTIALLY_PAID','PAID','CANCELLED'))
     OR (DocType = 'PAY' AND Status IN ('DRAFT','PENDING_APPROVAL','RETURNED','APPROVED','REJECTED','SENT_TO_BANK','POSTED','COMPLETED','FAILED','CANCELLED'))
     OR (DocType = 'CA'  AND Status IN ('DRAFT','PENDING_APPROVAL','RETURNED','APPROVED','REJECTED','PAYMENT_PROCESSING','DISBURSED','SETTLED','CLOSED','CANCELLED'))
     OR (DocType = 'STL' AND Status IN ('DRAFT','PENDING_APPROVAL','RETURNED','APPROVED','REJECTED','CLOSED','CANCELLED'))
     OR (DocType = 'RMB' AND Status IN ('DRAFT','PENDING_APPROVAL','RETURNED','APPROVED','REJECTED','PAYMENT_PROCESSING','PARTIALLY_PAID','PAID','CANCELLED'))
     OR (DocType = 'ARI' AND Status IN ('DRAFT','PENDING_APPROVAL','RETURNED','APPROVED','REJECTED','ISSUED','PARTIALLY_PAID','PAID','CANCELLED'))
     OR (DocType = 'RCV' AND Status IN ('DRAFT','POSTED','CANCELLED')));
ALTER TABLE tr_document_attachment DROP CONSTRAINT IF EXISTS ck_tr_document_attachment_category, ADD CONSTRAINT ck_tr_document_attachment_category CHECK (Category IN
      ('SPECIFICATION','QUOTATION','INVOICE','TAX_INVOICE','DELIVERY_NOTE','BAST','QC_REPORT','PAYMENT_PROOF','CONTRACT','OTHER'));
ALTER TABLE tr_document_attachment DROP CONSTRAINT IF EXISTS ck_tr_document_attachment_visibility, ADD CONSTRAINT ck_tr_document_attachment_visibility CHECK (Visibility IN ('SHARED','INTERNAL'));
ALTER TABLE tr_document_attachment DROP CONSTRAINT IF EXISTS ck_tr_document_attachment_signing, ADD CONSTRAINT ck_tr_document_attachment_signing CHECK (SigningStatus IN ('NONE','PENDING','SIGNED','FAILED'));
ALTER TABLE tr_document_attachment DROP CONSTRAINT IF EXISTS ck_tr_document_attachment_signed, ADD CONSTRAINT ck_tr_document_attachment_signed CHECK (SigningStatus <> 'SIGNED' OR SignedFileId IS NOT NULL);
ALTER TABLE tr_document_attachment DROP CONSTRAINT IF EXISTS ck_tr_document_attachment_stamp, ADD CONSTRAINT ck_tr_document_attachment_stamp CHECK (StampStatus IN ('NONE','PENDING','STAMPED','FAILED'));
ALTER TABLE tr_document_attachment DROP CONSTRAINT IF EXISTS ck_tr_document_attachment_stamped, ADD CONSTRAINT ck_tr_document_attachment_stamped CHECK (StampStatus <> 'STAMPED' OR StampedFileId IS NOT NULL);
ALTER TABLE tr_document_attachment DROP CONSTRAINT IF EXISTS ck_tr_document_attachment_removed, ADD CONSTRAINT ck_tr_document_attachment_removed CHECK ((RemovedAt IS NULL AND RemovedBy IS NULL) OR (RemovedAt IS NOT NULL AND RemovedBy IS NOT NULL));
ALTER TABLE tr_document_comment DROP CONSTRAINT IF EXISTS ck_tr_document_comment_visibility, ADD CONSTRAINT ck_tr_document_comment_visibility CHECK (Visibility IN ('SHARED','INTERNAL'));
-- subtype guards: DocType column is fixed per subtype table
ALTER TABLE tr_purchase_request DROP CONSTRAINT IF EXISTS ck_tr_purchase_request_doctype, ADD CONSTRAINT ck_tr_purchase_request_doctype CHECK (DocType = 'PR');
ALTER TABLE tr_purchase_request DROP CONSTRAINT IF EXISTS ck_tr_purchase_request_sourcing, ADD CONSTRAINT ck_tr_purchase_request_sourcing CHECK (SourcingMethod IN ('DIRECT','RFQ'));
-- Subtotal / VAT / GrandTotal are written only by triggers (see triggers.sql)
ALTER TABLE tr_purchase_contract DROP CONSTRAINT IF EXISTS ck_tr_purchase_contract_doctype, ADD CONSTRAINT ck_tr_purchase_contract_doctype CHECK (DocType = 'CTR');
ALTER TABLE tr_purchase_contract DROP CONSTRAINT IF EXISTS ck_tr_purchase_contract_period, ADD CONSTRAINT ck_tr_purchase_contract_period CHECK (EndDate >= StartDate);
ALTER TABLE tr_purchase_contract DROP CONSTRAINT IF EXISTS ck_tr_purchase_contract_type, ADD CONSTRAINT ck_tr_purchase_contract_type CHECK ((AgreementType = 'QUANTITY' AND TargetAmount IS NULL)
                                               OR (AgreementType = 'AMOUNT' AND TargetAmount > 0));
-- total is the sale amount − down payment + PPN − PPh; DPP (TaxBaseAmount) may differ (DPP nilai lain 11/12)
-- a down payment invoice is not itself reduced by another down payment
-- the code may sit on the lines instead (mixed PPh); header-only invoices are checked on submit (51098)
-- transfers need the payee's account; cash payments have none
ALTER TABLE tr_cash_advance DROP CONSTRAINT IF EXISTS ck_tr_cash_advance_doctype, ADD CONSTRAINT ck_tr_cash_advance_doctype CHECK (DocType = 'CA');
ALTER TABLE tr_settlement DROP CONSTRAINT IF EXISTS ck_tr_settlement_doctype, ADD CONSTRAINT ck_tr_settlement_doctype CHECK (DocType = 'STL');
ALTER TABLE tr_settlement DROP CONSTRAINT IF EXISTS ck_tr_settlement_amounts, ADD CONSTRAINT ck_tr_settlement_amounts CHECK (AdvanceAmount >= 0 AND SpentAmount >= 0 AND DifferenceAmount = AdvanceAmount - SpentAmount);
ALTER TABLE tr_reimbursement DROP CONSTRAINT IF EXISTS ck_tr_reimbursement_doctype, ADD CONSTRAINT ck_tr_reimbursement_doctype CHECK (DocType = 'RMB');
ALTER TABLE tr_reimbursement DROP CONSTRAINT IF EXISTS ck_tr_reimbursement_payee, ADD CONSTRAINT ck_tr_reimbursement_payee CHECK ((PayeeType = 'EMPLOYEE' AND EmployeeUserId IS NOT NULL) OR (PayeeType = 'BP' AND EmployeeUserId IS NULL));
-- Subtotal / NetReceivable are written only by triggers (see triggers.sql)
ALTER TABLE tr_ar_invoice DROP CONSTRAINT IF EXISTS ck_tr_ar_invoice_doctype, ADD CONSTRAINT ck_tr_ar_invoice_doctype CHECK (DocType = 'ARI');
ALTER TABLE tr_ar_invoice DROP CONSTRAINT IF EXISTS ck_tr_ar_invoice_kind, ADD CONSTRAINT ck_tr_ar_invoice_kind CHECK ((InvoiceKind IN ('ITEM','SERVICE') AND OriginalInvoiceId IS NULL)
                                       OR (InvoiceKind IN ('CREDIT_MEMO','DEBIT_MEMO','RETURN') AND OriginalInvoiceId IS NOT NULL));
ALTER TABLE tr_ar_invoice DROP CONSTRAINT IF EXISTS ck_tr_ar_invoice_amounts, ADD CONSTRAINT ck_tr_ar_invoice_amounts CHECK (SubtotalAmount >= 0 AND DiscountAmount >= 0 AND FreightAmount >= 0 AND DownPaymentAmount >= 0
      AND TaxBaseAmount >= 0 AND VatAmount >= 0 AND WhtAmount >= 0);
ALTER TABLE tr_ar_invoice DROP CONSTRAINT IF EXISTS ck_tr_ar_invoice_dates, ADD CONSTRAINT ck_tr_ar_invoice_dates CHECK (DueDate IS NULL OR DueDate >= InvoiceDate);
ALTER TABLE tr_ar_invoice DROP CONSTRAINT IF EXISTS ck_tr_ar_invoice_taxrate, ADD CONSTRAINT ck_tr_ar_invoice_taxrate CHECK (TaxExchangeRate IS NULL OR TaxExchangeRate > 0);
-- final-pay deduction from a leaving employee has no bank account; every other receipt does
ALTER TABLE tr_receipt DROP CONSTRAINT IF EXISTS ck_tr_receipt_doctype, ADD CONSTRAINT ck_tr_receipt_doctype CHECK (DocType = 'RCV');
ALTER TABLE tr_receipt DROP CONSTRAINT IF EXISTS ck_tr_receipt_payer, ADD CONSTRAINT ck_tr_receipt_payer CHECK ((PayerType = 'EMPLOYEE' AND EmployeeUserId IS NOT NULL) OR (PayerType = 'BP' AND EmployeeUserId IS NULL));
ALTER TABLE tr_receipt DROP CONSTRAINT IF EXISTS ck_tr_receipt_amount, ADD CONSTRAINT ck_tr_receipt_amount CHECK (Amount >= 0);
ALTER TABLE tr_receipt DROP CONSTRAINT IF EXISTS ck_tr_receipt_method, ADD CONSTRAINT ck_tr_receipt_method CHECK (ReceiptMethod IN ('TRANSFER','CASH','PAYROLL_DEDUCTION'));
ALTER TABLE tr_receipt DROP CONSTRAINT IF EXISTS ck_tr_receipt_account, ADD CONSTRAINT ck_tr_receipt_account CHECK ((ReceiptMethod = 'PAYROLL_DEDUCTION' AND PayerType = 'EMPLOYEE' AND CompanyBankAccountId IS NULL)
                                       OR (ReceiptMethod <> 'PAYROLL_DEDUCTION' AND CompanyBankAccountId IS NOT NULL));
ALTER TABLE tr_user_handover DROP CONSTRAINT IF EXISTS ck_tr_user_handover_reason, ADD CONSTRAINT ck_tr_user_handover_reason CHECK (Reason IN ('RESIGNED','TERMINATED','RETIRED','TRANSFERRED','LEAVE'));
ALTER TABLE tr_user_handover DROP CONSTRAINT IF EXISTS ck_tr_user_handover_users, ADD CONSTRAINT ck_tr_user_handover_users CHECK (FromUserId <> ToUserId);
ALTER TABLE tr_user_handover DROP CONSTRAINT IF EXISTS ck_tr_user_handover_counts, ADD CONSTRAINT ck_tr_user_handover_counts CHECK (DocumentsTransferred >= 0 AND MappingsTransferred >= 0
                                             AND PicRolesTransferred >= 0 AND OrgRolesTransferred >= 0);
ALTER TABLE tr_user_handover DROP CONSTRAINT IF EXISTS ck_tr_user_handover_status, ADD CONSTRAINT ck_tr_user_handover_status CHECK (Status IN ('OPEN','COMPLETED','CANCELLED'));
ALTER TABLE tr_user_handover DROP CONSTRAINT IF EXISTS ck_tr_user_handover_done, ADD CONSTRAINT ck_tr_user_handover_done CHECK ((Status = 'OPEN' AND CompletedAt IS NULL) OR (Status <> 'OPEN' AND CompletedAt IS NOT NULL));
-- segregation of duties: the approver is neither party nor the requester
ALTER TABLE tr_approval_reassignment DROP CONSTRAINT IF EXISTS ck_tr_approval_reassignment_reason, ADD CONSTRAINT ck_tr_approval_reassignment_reason CHECK (Reason IN ('RESIGNED','TRANSFERRED','LEAVE','WORKLOAD','WRONG_ASSIGNEE','OTHER'));
ALTER TABLE tr_approval_reassignment DROP CONSTRAINT IF EXISTS ck_tr_approval_reassignment_status, ADD CONSTRAINT ck_tr_approval_reassignment_status CHECK (Status IN ('PENDING','APPROVED','REJECTED','CANCELLED'));
ALTER TABLE tr_approval_reassignment DROP CONSTRAINT IF EXISTS ck_tr_approval_reassignment_parties, ADD CONSTRAINT ck_tr_approval_reassignment_parties CHECK (FromUserId <> ToUserId AND ApproverUserId <> FromUserId
                                                       AND ApproverUserId <> ToUserId AND ApproverUserId <> RequestedBy);
ALTER TABLE tr_approval_reassignment DROP CONSTRAINT IF EXISTS ck_tr_approval_reassignment_decided, ADD CONSTRAINT ck_tr_approval_reassignment_decided CHECK ((Status = 'PENDING' AND DecidedAt IS NULL) OR (Status <> 'PENDING' AND DecidedAt IS NOT NULL));
ALTER TABLE tr_approval_reassignment DROP CONSTRAINT IF EXISTS ck_tr_approval_reassignment_rejectremark, ADD CONSTRAINT ck_tr_approval_reassignment_rejectremark CHECK (Status <> 'REJECTED' OR DecisionRemarks IS NOT NULL);
ALTER TABLE tr_approval_reassignment_item DROP CONSTRAINT IF EXISTS ck_tr_approval_reassignment_item_tasks, ADD CONSTRAINT ck_tr_approval_reassignment_item_tasks CHECK (NewTaskId IS NULL OR NewTaskId <> OldTaskId);
ALTER TABLE hist_handover_item DROP CONSTRAINT IF EXISTS ck_hist_handover_item_type, ADD CONSTRAINT ck_hist_handover_item_type CHECK (ItemType IN ('DOCUMENT_OWNER','APPROVER_MAPPING','TEMPLATE_STEP','BP_PIC','DEPARTMENT_HEAD','SUPERIOR'));
ALTER TABLE hist_handover_item DROP CONSTRAINT IF EXISTS ck_hist_handover_item_users, ADD CONSTRAINT ck_hist_handover_item_users CHECK (OldUserId IS NOT NULL OR NewUserId IS NOT NULL);
-- verification
ALTER TABLE tr_bp_verification_check DROP CONSTRAINT IF EXISTS ck_tr_bp_verification_check_area, ADD CONSTRAINT ck_tr_bp_verification_check_area CHECK (CheckArea IN ('PROFILE','LEGAL','TAX','BANK','DOCUMENT','CATEGORY'));
ALTER TABLE tr_bp_verification_check DROP CONSTRAINT IF EXISTS ck_tr_bp_verification_check_result, ADD CONSTRAINT ck_tr_bp_verification_check_result CHECK (Result IN ('PASS','FAIL','NA'));
ALTER TABLE tr_bp_verification_check DROP CONSTRAINT IF EXISTS ck_tr_bp_verification_check_failneedsremark, ADD CONSTRAINT ck_tr_bp_verification_check_failneedsremark CHECK (Result <> 'FAIL' OR Remarks IS NOT NULL);
ALTER TABLE tr_bp_profile_change DROP CONSTRAINT IF EXISTS ck_tr_bp_profile_change_field, ADD CONSTRAINT ck_tr_bp_profile_change_field CHECK (FieldName IN
  ('LegalName','TradeName','TaxId','BusinessRegNo','IsVatRegistered','EntityType','Email','Phone','CountryCode'));
-- procurement lines
-- no over-ordering
ALTER TABLE tr_purchase_request_line DROP CONSTRAINT IF EXISTS ck_tr_pr_line_qty, ADD CONSTRAINT ck_tr_pr_line_qty CHECK (Quantity > 0 AND OrderedQty BETWEEN 0 AND Quantity);
ALTER TABLE tr_purchase_request_line DROP CONSTRAINT IF EXISTS ck_tr_pr_line_price, ADD CONSTRAINT ck_tr_pr_line_price CHECK (EstimatedUnitPrice IS NULL OR EstimatedUnitPrice >= 0);
ALTER TABLE tr_purchase_request_line DROP CONSTRAINT IF EXISTS ck_tr_pr_line_status, ADD CONSTRAINT ck_tr_pr_line_status CHECK (LineStatus IN ('OPEN','SOURCING','PARTIAL','ORDERED','CLOSED','CANCELLED'));
ALTER TABLE tr_rfq_line DROP CONSTRAINT IF EXISTS ck_tr_rfq_line_qty, ADD CONSTRAINT ck_tr_rfq_line_qty CHECK (Quantity > 0);
ALTER TABLE tr_purchase_request_line DROP CONSTRAINT IF EXISTS ck_tr_pr_line_inventory, ADD CONSTRAINT ck_tr_pr_line_inventory CHECK (InventoryQty IS NULL OR InventoryQty > 0);
ALTER TABLE tr_purchase_order_line DROP CONSTRAINT IF EXISTS ck_tr_po_line_pack, ADD CONSTRAINT ck_tr_po_line_pack CHECK ((PackSize IS NULL OR PackSize > 0) AND (InventoryQty IS NULL OR InventoryQty > 0)
                                                                        AND (PricePerInventoryUnit IS NULL OR PricePerInventoryUnit >= 0));
ALTER TABLE mst_item DROP CONSTRAINT IF EXISTS ck_mst_item_pack, ADD CONSTRAINT ck_mst_item_pack CHECK (PackSize IS NULL OR PackSize > 0);
ALTER TABLE tr_rfq_participant DROP CONSTRAINT IF EXISTS ck_tr_rfq_participant_status, ADD CONSTRAINT ck_tr_rfq_participant_status CHECK (InvitationStatus IN ('INVITED','VIEWED','DECLINED','QUOTED'));
ALTER TABLE tr_quotation_line DROP CONSTRAINT IF EXISTS ck_tr_quotation_line_values, ADD CONSTRAINT ck_tr_quotation_line_values CHECK (Quantity > 0 AND UnitPrice >= 0 AND LineAmount >= 0 AND DiscountPercent BETWEEN 0 AND 100);
ALTER TABLE tr_quotation_line DROP CONSTRAINT IF EXISTS ck_tr_quotation_line_award, ADD CONSTRAINT ck_tr_quotation_line_award CHECK (AwardedQty BETWEEN 0 AND Quantity);
-- no over-receipt / over-billing; invoiced ≤ received is checked when an invoice is submitted (51104), because a
-- return to the supplier may legitimately drop ReceivedQty below InvoicedQty until the credit memo arrives
ALTER TABLE tr_purchase_order_line DROP CONSTRAINT IF EXISTS ck_tr_po_line_progress, ADD CONSTRAINT ck_tr_po_line_progress CHECK (ReceivedQty BETWEEN 0 AND Quantity AND InvoicedQty BETWEEN 0 AND Quantity);
ALTER TABLE tr_purchase_order_line DROP CONSTRAINT IF EXISTS ck_tr_po_line_values, ADD CONSTRAINT ck_tr_po_line_values CHECK (Quantity > 0 AND UnitPrice >= 0 AND LineAmount >= 0 AND VatAmount >= 0 AND DiscountPercent BETWEEN 0 AND 100);
ALTER TABLE tr_purchase_order_line DROP CONSTRAINT IF EXISTS ck_tr_po_line_status, ADD CONSTRAINT ck_tr_po_line_status CHECK (LineStatus IN ('OPEN','PARTIAL','RECEIVED','CLOSED','CANCELLED'));
ALTER TABLE tr_goods_receipt_line DROP CONSTRAINT IF EXISTS ck_tr_gr_line_qty, ADD CONSTRAINT ck_tr_gr_line_qty CHECK (ReceivedQty > 0 AND AcceptedQty >= 0 AND RejectedQty >= 0 AND AcceptedQty + RejectedQty = ReceivedQty);
ALTER TABLE tr_goods_receipt_line DROP CONSTRAINT IF EXISTS ck_tr_gr_line_rejectreason, ADD CONSTRAINT ck_tr_gr_line_rejectreason CHECK (RejectedQty = 0 OR RejectReason IS NOT NULL);
ALTER TABLE tr_goods_receipt_line DROP CONSTRAINT IF EXISTS ck_tr_gr_line_notself, ADD CONSTRAINT ck_tr_gr_line_notself CHECK (ReturnOfLineId IS NULL OR ReturnOfLineId <> Id);
ALTER TABLE tr_purchase_contract_line DROP CONSTRAINT IF EXISTS ck_tr_purchase_contract_line_values, ADD CONSTRAINT ck_tr_purchase_contract_line_values CHECK ((TargetQty IS NULL OR TargetQty > 0) AND UnitPrice >= 0 AND DiscountPercent BETWEEN 0 AND 100);
-- creditable import taxes are recorded, never capitalized into the goods' cost
ALTER TABLE tr_landed_cost DROP CONSTRAINT IF EXISTS ck_tr_landed_cost_type, ADD CONSTRAINT ck_tr_landed_cost_type CHECK (CostType IN ('FREIGHT','INSURANCE','CUSTOMS_DUTY','IMPORT_VAT','IMPORT_WHT','HANDLING','OTHER'));
ALTER TABLE tr_landed_cost DROP CONSTRAINT IF EXISTS ck_tr_landed_cost_method, ADD CONSTRAINT ck_tr_landed_cost_method CHECK (AllocationMethod IN ('VALUE','QUANTITY'));
ALTER TABLE tr_landed_cost DROP CONSTRAINT IF EXISTS ck_tr_landed_cost_status, ADD CONSTRAINT ck_tr_landed_cost_status CHECK (Status IN ('DRAFT','POSTED','CANCELLED'));
ALTER TABLE tr_landed_cost DROP CONSTRAINT IF EXISTS ck_tr_landed_cost_amount, ADD CONSTRAINT ck_tr_landed_cost_amount CHECK (Amount > 0 AND ExchangeRate > 0 AND AmountBase = ROUND(Amount * ExchangeRate, 2));
ALTER TABLE tr_landed_cost DROP CONSTRAINT IF EXISTS ck_tr_landed_cost_idrrate, ADD CONSTRAINT ck_tr_landed_cost_idrrate CHECK (CurrencyCode <> 'IDR' OR ExchangeRate = 1);
ALTER TABLE tr_landed_cost DROP CONSTRAINT IF EXISTS ck_tr_landed_cost_tax, ADD CONSTRAINT ck_tr_landed_cost_tax CHECK (CostType NOT IN ('IMPORT_VAT','IMPORT_WHT') OR IsCapitalized = false);
ALTER TABLE tr_landed_cost DROP CONSTRAINT IF EXISTS ck_tr_landed_cost_posted, ADD CONSTRAINT ck_tr_landed_cost_posted CHECK (Status = 'DRAFT' OR (PostedAt IS NOT NULL AND PostedBy IS NOT NULL));
ALTER TABLE tr_landed_cost_allocation DROP CONSTRAINT IF EXISTS ck_tr_landed_cost_allocation_amount, ADD CONSTRAINT ck_tr_landed_cost_allocation_amount CHECK (AmountBase >= 0);
ALTER TABLE tr_receipt_acceptance DROP CONSTRAINT IF EXISTS ck_tr_receipt_acceptance_type, ADD CONSTRAINT ck_tr_receipt_acceptance_type CHECK (AcceptanceType IN ('BAST','QC','KAB'));
ALTER TABLE tr_receipt_acceptance DROP CONSTRAINT IF EXISTS ck_tr_receipt_acceptance_result, ADD CONSTRAINT ck_tr_receipt_acceptance_result CHECK (Result IN ('ACCEPTED','REJECTED','CONDITIONAL'));
ALTER TABLE tr_ap_invoice_line DROP CONSTRAINT IF EXISTS ck_tr_ap_invoice_line_values, ADD CONSTRAINT ck_tr_ap_invoice_line_values CHECK (Quantity > 0 AND UnitPrice >= 0 AND LineAmount >= 0);
ALTER TABLE tr_ap_invoice_line DROP CONSTRAINT IF EXISTS ck_tr_ap_invoice_line_vat, ADD CONSTRAINT ck_tr_ap_invoice_line_vat CHECK (VatAmount >= 0 AND (VatAmount = 0 OR VatTaxCodeId IS NOT NULL));
ALTER TABLE tr_ap_invoice_line DROP CONSTRAINT IF EXISTS ck_tr_ap_invoice_line_wht, ADD CONSTRAINT ck_tr_ap_invoice_line_wht CHECK (WhtAmount >= 0 AND (WhtAmount = 0 OR (WhtTaxCodeId IS NOT NULL AND WhtBaseAmount IS NOT NULL)));
ALTER TABLE tr_ap_down_payment_application DROP CONSTRAINT IF EXISTS ck_tr_ap_down_payment_application_amount, ADD CONSTRAINT ck_tr_ap_down_payment_application_amount CHECK (Amount > 0);
ALTER TABLE tr_ap_down_payment_application DROP CONSTRAINT IF EXISTS ck_tr_ap_down_payment_application_self, ADD CONSTRAINT ck_tr_ap_down_payment_application_self CHECK (InvoiceId <> DownPaymentInvoiceId);
ALTER TABLE tr_payment_allocation DROP CONSTRAINT IF EXISTS ck_tr_payment_allocation_amount, ADD CONSTRAINT ck_tr_payment_allocation_amount CHECK (AmountApplied > 0 AND AmountInPaymentCurrency > 0);
ALTER TABLE tr_payment_allocation DROP CONSTRAINT IF EXISTS ck_tr_payment_allocation_discount, ADD CONSTRAINT ck_tr_payment_allocation_discount CHECK (DiscountAmount >= 0 AND DiscountAmount < AmountApplied);
ALTER TABLE tr_payment_line DROP CONSTRAINT IF EXISTS ck_tr_payment_line_amount, ADD CONSTRAINT ck_tr_payment_line_amount CHECK (Amount <> 0);
ALTER TABLE tr_receipt_allocation DROP CONSTRAINT IF EXISTS ck_tr_receipt_allocation_amount, ADD CONSTRAINT ck_tr_receipt_allocation_amount CHECK (AmountApplied > 0 AND AmountInReceiptCurrency > 0);
ALTER TABLE tr_fx_revaluation DROP CONSTRAINT IF EXISTS ck_tr_fx_revaluation_status, ADD CONSTRAINT ck_tr_fx_revaluation_status CHECK (Status IN ('DRAFT','POSTED','REVERSED'));
ALTER TABLE tr_fx_revaluation DROP CONSTRAINT IF EXISTS ck_tr_fx_revaluation_ratetype, ADD CONSTRAINT ck_tr_fx_revaluation_ratetype CHECK (RateType IN ('MIDDLE','TAX','BANK'));
ALTER TABLE tr_fx_revaluation DROP CONSTRAINT IF EXISTS ck_tr_fx_revaluation_posted, ADD CONSTRAINT ck_tr_fx_revaluation_posted CHECK (Status = 'DRAFT' OR JournalId IS NOT NULL);
ALTER TABLE tr_fx_revaluation DROP CONSTRAINT IF EXISTS ck_tr_fx_revaluation_reversed, ADD CONSTRAINT ck_tr_fx_revaluation_reversed CHECK (Status <> 'REVERSED' OR ReversalJournalId IS NOT NULL);
ALTER TABLE tr_fx_revaluation_line DROP CONSTRAINT IF EXISTS ck_tr_fx_revaluation_line_rates, ADD CONSTRAINT ck_tr_fx_revaluation_line_rates CHECK (BookRate > 0 AND RevalRate > 0 AND CurrencyCode <> 'IDR');
ALTER TABLE tr_fx_revaluation_line DROP CONSTRAINT IF EXISTS ck_tr_fx_revaluation_line_diff, ADD CONSTRAINT ck_tr_fx_revaluation_line_diff CHECK (DifferenceBase = ROUND(OpenAmount * RevalRate, 2) - ROUND(OpenAmount * BookRate, 2));
ALTER TABLE tr_expense_line DROP CONSTRAINT IF EXISTS ck_tr_expense_line_amount, ADD CONSTRAINT ck_tr_expense_line_amount CHECK (Amount > 0);
ALTER TABLE tr_ar_invoice_line DROP CONSTRAINT IF EXISTS ck_tr_ar_invoice_line_values, ADD CONSTRAINT ck_tr_ar_invoice_line_values CHECK (Quantity > 0 AND UnitPrice >= 0 AND LineAmount >= 0
      AND VatAmount >= 0 AND DiscountPercent BETWEEN 0 AND 100);
-- general ledger
ALTER TABLE tr_journal_entry DROP CONSTRAINT IF EXISTS ck_tr_journal_entry_status, ADD CONSTRAINT ck_tr_journal_entry_status CHECK (Status IN ('DRAFT','POSTED','REVERSED'));
ALTER TABLE tr_journal_entry DROP CONSTRAINT IF EXISTS ck_tr_journal_entry_reversal, ADD CONSTRAINT ck_tr_journal_entry_reversal CHECK (ReversalOfId IS NULL OR ReversalOfId <> Id);
ALTER TABLE tr_journal_line DROP CONSTRAINT IF EXISTS ck_tr_journal_line_side, ADD CONSTRAINT ck_tr_journal_line_side CHECK (Debit >= 0 AND Credit >= 0 AND (Debit = 0 OR Credit = 0) AND Debit + Credit > 0);
-- approval runtime
ALTER TABLE tr_approval_request DROP CONSTRAINT IF EXISTS ck_tr_approval_request_status, ADD CONSTRAINT ck_tr_approval_request_status CHECK (Status IN ('PENDING','APPROVED','REJECTED','RETURNED','CANCELLED'));
ALTER TABLE tr_approval_request DROP CONSTRAINT IF EXISTS ck_tr_approval_request_completed, ADD CONSTRAINT ck_tr_approval_request_completed CHECK ((Status = 'PENDING' AND CompletedAt IS NULL) OR (Status <> 'PENDING' AND CompletedAt IS NOT NULL));
ALTER TABLE tr_approval_task DROP CONSTRAINT IF EXISTS ck_tr_approval_task_status, ADD CONSTRAINT ck_tr_approval_task_status CHECK (Status IN ('WAITING','PENDING','APPROVED','REJECTED','RETURNED','SKIPPED','CANCELLED','REASSIGNED'));
ALTER TABLE tr_approval_task DROP CONSTRAINT IF EXISTS ck_tr_approval_task_notselfreplace, ADD CONSTRAINT ck_tr_approval_task_notselfreplace CHECK (ReplacesTaskId IS NULL OR ReplacesTaskId <> Id);
ALTER TABLE tr_approval_task DROP CONSTRAINT IF EXISTS ck_tr_approval_task_actingas, ADD CONSTRAINT ck_tr_approval_task_actingas CHECK (ActingAs IS NULL OR ActingAs IN ('SELF','DELEGATE','BACKUP','SUPERIOR'));
ALTER TABLE tr_approval_task DROP CONSTRAINT IF EXISTS ck_tr_approval_task_decision, ADD CONSTRAINT ck_tr_approval_task_decision CHECK (
        (Status IN ('APPROVED','REJECTED','RETURNED') AND ActedByUserId IS NOT NULL AND ActedAt IS NOT NULL AND ActingAs IS NOT NULL)
     OR (Status NOT IN ('APPROVED','REJECTED','RETURNED') AND ActedByUserId IS NULL));
ALTER TABLE tr_approval_task DROP CONSTRAINT IF EXISTS ck_tr_approval_task_remarkonnegative, ADD CONSTRAINT ck_tr_approval_task_remarkonnegative CHECK (Status NOT IN ('REJECTED','RETURNED','REASSIGNED') OR Remarks IS NOT NULL);
ALTER TABLE tr_notification DROP CONSTRAINT IF EXISTS ck_tr_notification_email, ADD CONSTRAINT ck_tr_notification_email CHECK (EmailStatus IN ('NONE','QUEUED','SENT','FAILED'));
-- history
ALTER TABLE hist_document_status DROP CONSTRAINT IF EXISTS ck_hist_document_status_changed, ADD CONSTRAINT ck_hist_document_status_changed CHECK (FromStatus IS NULL OR FromStatus <> ToStatus);
ALTER TABLE hist_bp_status DROP CONSTRAINT IF EXISTS ck_hist_bp_status_kind, ADD CONSTRAINT ck_hist_bp_status_kind CHECK (StatusKind IN ('ONBOARDING','OPERATIONAL'));
ALTER TABLE hist_bp_status DROP CONSTRAINT IF EXISTS ck_hist_bp_status_reasononblock, ADD CONSTRAINT ck_hist_bp_status_reasononblock CHECK (ToStatus NOT IN ('SUSPENDED','BLACKLISTED','REJECTED') OR Reason IS NOT NULL);
ALTER TABLE hist_user_activity DROP CONSTRAINT IF EXISTS ck_hist_user_activity_action, ADD CONSTRAINT ck_hist_user_activity_action CHECK (Action IN
  ('LOGIN','LOGIN_FAILED','LOGOUT','SESSION_EXPIRED','SESSION_REVOKED','TOKEN_REUSE_DETECTED','LOCKED_OUT',
   'PASSWORD_CHANGED','PASSWORD_RESET','PASSWORD_RESET_REQUESTED','OTP_REQUESTED','OTP_FAILED','RATE_LIMITED',
   'ROLE_CHANGED','ACTIVATED','DEACTIVATED','BP_LINKED','BP_UNLINKED'));
ALTER TABLE hist_audit_log DROP CONSTRAINT IF EXISTS ck_hist_audit_log_action, ADD CONSTRAINT ck_hist_audit_log_action CHECK (Action IN ('INSERT','UPDATE','DELETE'));
ALTER TABLE hist_audit_log DROP CONSTRAINT IF EXISTS ck_hist_audit_log_json, ADD CONSTRAINT ck_hist_audit_log_json CHECK (Changes IS JSON);
ALTER TABLE mst_form_note DROP CONSTRAINT IF EXISTS ck_mst_form_note_doctype, ADD CONSTRAINT ck_mst_form_note_doctype CHECK (DocType IN ('PR','PO','CTR','CA','STL','RMB','ARI','INV','PAY','RFQ'));
ALTER TABLE mst_remark_template DROP CONSTRAINT IF EXISTS ck_mst_remark_template_module, ADD CONSTRAINT ck_mst_remark_template_module CHECK (Module IN ('CA','STL','RMB','ALL'));
ALTER TABLE tr_document_approver_pick DROP CONSTRAINT IF EXISTS ck_tr_document_approver_pick_step, ADD CONSTRAINT ck_tr_document_approver_pick_step CHECK (StepCode IN ('CH','AC','AP','RE','CL'));
ALTER TABLE sys_rate_limit DROP CONSTRAINT IF EXISTS ck_sys_rate_limit_window, ADD CONSTRAINT ck_sys_rate_limit_window CHECK (HitCount >= 0 AND ResetAt > WindowStartAt);
ALTER TABLE mst_approval_backup DROP CONSTRAINT IF EXISTS ck_mst_approval_backup_users, ADD CONSTRAINT ck_mst_approval_backup_users CHECK (ApproverUserId <> BackupUserId);
ALTER TABLE hist_access_log DROP CONSTRAINT IF EXISTS ck_hist_access_log_action, ADD CONSTRAINT ck_hist_access_log_action CHECK (Action IN ('VIEW_DELETED','DOWNLOAD_FILE','PRINT','EXPORT','VIEW_SENSITIVE'));
ALTER TABLE hist_rate_import DROP CONSTRAINT IF EXISTS ck_hist_rate_import_source, ADD CONSTRAINT ck_hist_rate_import_source CHECK (Source IN ('BI','KMK','SAP_ORTT','MANUAL_FILE'));
ALTER TABLE hist_rate_import DROP CONSTRAINT IF EXISTS ck_hist_rate_import_ratetype, ADD CONSTRAINT ck_hist_rate_import_ratetype CHECK (RateType IN ('MIDDLE','TAX','BANK'));
ALTER TABLE hist_rate_import DROP CONSTRAINT IF EXISTS ck_hist_rate_import_status, ADD CONSTRAINT ck_hist_rate_import_status CHECK (Status IN ('RUNNING','SUCCESS','PARTIAL','FAILED'));
ALTER TABLE hist_rate_import DROP CONSTRAINT IF EXISTS ck_hist_rate_import_done, ADD CONSTRAINT ck_hist_rate_import_done CHECK (Status = 'RUNNING' OR FinishedAt IS NOT NULL);
ALTER TABLE hist_rate_import DROP CONSTRAINT IF EXISTS ck_hist_rate_import_error, ADD CONSTRAINT ck_hist_rate_import_error CHECK (Status NOT IN ('PARTIAL','FAILED') OR ErrorMessage IS NOT NULL);
ALTER TABLE hist_bank_callback DROP CONSTRAINT IF EXISTS ck_hist_bank_callback_event, ADD CONSTRAINT ck_hist_bank_callback_event CHECK (EventType IN ('POSTED','PAID','FAILED'));
ALTER TABLE hist_bank_callback DROP CONSTRAINT IF EXISTS ck_hist_bank_callback_result, ADD CONSTRAINT ck_hist_bank_callback_result CHECK (ProcessResult IN ('APPLIED','DUPLICATE','NOT_FOUND','INVALID_STATE','ERROR'));
ALTER TABLE hist_bank_callback DROP CONSTRAINT IF EXISTS ck_hist_bank_callback_applied, ADD CONSTRAINT ck_hist_bank_callback_applied CHECK (ProcessResult NOT IN ('APPLIED','DUPLICATE') OR PaymentId IS NOT NULL OR TargetDocumentId IS NOT NULL);
ALTER TABLE hist_bank_callback DROP CONSTRAINT IF EXISTS ck_hist_bank_callback_matched, ADD CONSTRAINT ck_hist_bank_callback_matched CHECK (MatchedBy IS NULL OR MatchedBy IN
      ('BANK_REFERENCE','DOC_NO','LEGACY_INVOICE_NO','BP_INVOICE_NO','TAX_INVOICE_NO','DOCUMENT_REFERENCE'));
-- system
-- max 25 MB
-- business documents only: PDF, images, Office, CSV
ALTER TABLE sys_file DROP CONSTRAINT IF EXISTS ck_sys_file_size, ADD CONSTRAINT ck_sys_file_size CHECK (SizeBytes > 0 AND SizeBytes <= 26214400);
ALTER TABLE sys_file DROP CONSTRAINT IF EXISTS ck_sys_file_scan, ADD CONSTRAINT ck_sys_file_scan CHECK (ScanStatus IN ('PENDING','CLEAN','INFECTED'));
ALTER TABLE sys_file DROP CONSTRAINT IF EXISTS ck_sys_file_scandate, ADD CONSTRAINT ck_sys_file_scandate CHECK (ScanStatus = 'PENDING' OR ScannedAt IS NOT NULL);
ALTER TABLE sys_file DROP CONSTRAINT IF EXISTS ck_sys_file_type, ADD CONSTRAINT ck_sys_file_type CHECK (ContentType IN ('application/pdf','image/jpeg','image/png',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','text/csv'));
-- ended <=> has a reason; only an admin revoke records EndedBy
ALTER TABLE sys_user_session DROP CONSTRAINT IF EXISTS ck_sys_user_session_authmethod, ADD CONSTRAINT ck_sys_user_session_authmethod CHECK (AuthMethod IN ('PASSWORD','PASSWORD_OTP','OTP','ENTRA_ID'));
ALTER TABLE sys_user_session DROP CONSTRAINT IF EXISTS ck_sys_user_session_endreason, ADD CONSTRAINT ck_sys_user_session_endreason CHECK (EndReason IS NULL OR EndReason IN
      ('LOGOUT','IDLE_TIMEOUT','EXPIRED','REVOKED_BY_ADMIN','PASSWORD_CHANGED','TOKEN_REUSE','USER_DISABLED'));
ALTER TABLE sys_user_session DROP CONSTRAINT IF EXISTS ck_sys_user_session_ended, ADD CONSTRAINT ck_sys_user_session_ended CHECK ((EndedAt IS NULL AND EndReason IS NULL AND EndedBy IS NULL)
                                           OR (EndedAt IS NOT NULL AND EndReason IS NOT NULL));
ALTER TABLE sys_user_session DROP CONSTRAINT IF EXISTS ck_sys_user_session_endedby, ADD CONSTRAINT ck_sys_user_session_endedby CHECK (EndedBy IS NULL OR EndReason = 'REVOKED_BY_ADMIN');
ALTER TABLE sys_user_session DROP CONSTRAINT IF EXISTS ck_sys_user_session_times, ADD CONSTRAINT ck_sys_user_session_times CHECK (ExpiresAt > StartedAt AND (EndedAt IS NULL OR EndedAt >= StartedAt));
-- 6th wrong try cannot be recorded → code is dead
ALTER TABLE sys_one_time_code DROP CONSTRAINT IF EXISTS ck_sys_one_time_code_purpose, ADD CONSTRAINT ck_sys_one_time_code_purpose CHECK (Purpose IN ('LOGIN','EMAIL_VERIFY','PASSWORD_RESET'));
ALTER TABLE sys_one_time_code DROP CONSTRAINT IF EXISTS ck_sys_one_time_code_attempts, ADD CONSTRAINT ck_sys_one_time_code_attempts CHECK (Attempts BETWEEN 0 AND 5);
ALTER TABLE sys_one_time_code DROP CONSTRAINT IF EXISTS ck_sys_one_time_code_expiry, ADD CONSTRAINT ck_sys_one_time_code_expiry CHECK (ExpiresAt > CreatedAt AND ExpiresAt <= CreatedAt + interval '30 minutes');
ALTER TABLE sys_number_series DROP CONSTRAINT IF EXISTS ck_sys_number_series_last, ADD CONSTRAINT ck_sys_number_series_last CHECK (LastNumber >= 0);
-- soft delete on master data: a deleted row is also inactive; who / when always recorded
ALTER TABLE mst_role DROP CONSTRAINT IF EXISTS ck_mst_role_softdelete, ADD CONSTRAINT ck_mst_role_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_department DROP CONSTRAINT IF EXISTS ck_mst_department_softdelete, ADD CONSTRAINT ck_mst_department_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_cost_center DROP CONSTRAINT IF EXISTS ck_mst_cost_center_softdelete, ADD CONSTRAINT ck_mst_cost_center_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_tax_code DROP CONSTRAINT IF EXISTS ck_mst_tax_code_softdelete, ADD CONSTRAINT ck_mst_tax_code_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_payment_term DROP CONSTRAINT IF EXISTS ck_mst_payment_term_softdelete, ADD CONSTRAINT ck_mst_payment_term_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_uom DROP CONSTRAINT IF EXISTS ck_mst_uom_softdelete, ADD CONSTRAINT ck_mst_uom_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_category DROP CONSTRAINT IF EXISTS ck_mst_category_softdelete, ADD CONSTRAINT ck_mst_category_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_purchase_class DROP CONSTRAINT IF EXISTS ck_mst_purchase_class_softdelete, ADD CONSTRAINT ck_mst_purchase_class_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_item DROP CONSTRAINT IF EXISTS ck_mst_item_softdelete, ADD CONSTRAINT ck_mst_item_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_form_note DROP CONSTRAINT IF EXISTS ck_mst_form_note_softdelete, ADD CONSTRAINT ck_mst_form_note_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_expense_category DROP CONSTRAINT IF EXISTS ck_mst_expense_category_softdelete, ADD CONSTRAINT ck_mst_expense_category_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_remark_template DROP CONSTRAINT IF EXISTS ck_mst_remark_template_softdelete, ADD CONSTRAINT ck_mst_remark_template_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_bank DROP CONSTRAINT IF EXISTS ck_mst_bank_softdelete, ADD CONSTRAINT ck_mst_bank_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_bp_document_type DROP CONSTRAINT IF EXISTS ck_mst_bp_document_type_softdelete, ADD CONSTRAINT ck_mst_bp_document_type_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_coa DROP CONSTRAINT IF EXISTS ck_mst_coa_softdelete, ADD CONSTRAINT ck_mst_coa_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_transaction_type DROP CONSTRAINT IF EXISTS ck_mst_transaction_type_softdelete, ADD CONSTRAINT ck_mst_transaction_type_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_expense_account DROP CONSTRAINT IF EXISTS ck_mst_expense_account_softdelete, ADD CONSTRAINT ck_mst_expense_account_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_company_bank_account DROP CONSTRAINT IF EXISTS ck_mst_company_bank_account_softdelete, ADD CONSTRAINT ck_mst_company_bank_account_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_employee_bank_account DROP CONSTRAINT IF EXISTS ck_mst_employee_bank_account_softdelete, ADD CONSTRAINT ck_mst_employee_bank_account_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_approver_mapping DROP CONSTRAINT IF EXISTS ck_mst_approver_mapping_softdelete, ADD CONSTRAINT ck_mst_approver_mapping_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_bp_address DROP CONSTRAINT IF EXISTS ck_mst_bp_address_softdelete, ADD CONSTRAINT ck_mst_bp_address_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_bp_contact DROP CONSTRAINT IF EXISTS ck_mst_bp_contact_softdelete, ADD CONSTRAINT ck_mst_bp_contact_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_bp_bank_account DROP CONSTRAINT IF EXISTS ck_mst_bp_bank_account_softdelete, ADD CONSTRAINT ck_mst_bp_bank_account_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_approval_template DROP CONSTRAINT IF EXISTS ck_mst_approval_template_softdelete, ADD CONSTRAINT ck_mst_approval_template_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_approval_backup DROP CONSTRAINT IF EXISTS ck_mst_approval_backup_softdelete, ADD CONSTRAINT ck_mst_approval_backup_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_business_partner DROP CONSTRAINT IF EXISTS ck_mst_business_partner_softdelete, ADD CONSTRAINT ck_mst_business_partner_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND OperationalStatus <> 'ACTIVE' AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_account_determination DROP CONSTRAINT IF EXISTS ck_mst_account_determination_softdelete, ADD CONSTRAINT ck_mst_account_determination_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));
ALTER TABLE mst_budget DROP CONSTRAINT IF EXISTS ck_mst_budget_softdelete, ADD CONSTRAINT ck_mst_budget_softdelete CHECK ((IsDeleted = false AND DeletedAt IS NULL AND DeletedBy IS NULL) OR (IsDeleted = true AND IsActive = false AND DeletedAt IS NOT NULL AND DeletedBy IS NOT NULL));

/* ---------------------------------------------------------------------
   2. Filtered unique indexes -> partial indexes. SQL Server treats NULLs as equal in a unique
      index, so every unique index here is NULLS NOT DISTINCT (Postgres 15+).
   --------------------------------------------------------------------- */
--------------------------------------------------------------------- */
CREATE UNIQUE INDEX IF NOT EXISTS ux_sys_user_credential_externalauthid ON sys_user_credential (AuthProvider, ExternalAuthId) NULLS NOT DISTINCT WHERE ExternalAuthId IS NOT NULL;
-- no duplicate business partner
CREATE UNIQUE INDEX IF NOT EXISTS ux_mst_bp_taxid ON mst_business_partner (TaxId) NULLS NOT DISTINCT WHERE TaxId IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_mst_bp_bpcode ON mst_business_partner (BpCode) NULLS NOT DISTINCT WHERE BpCode IS NOT NULL;
-- one primary per BP (per address type / per currency)
CREATE UNIQUE INDEX IF NOT EXISTS ux_mst_bp_address_primary ON mst_bp_address (BpId, AddressType) NULLS NOT DISTINCT WHERE IsPrimary = true AND IsActive = true;
CREATE UNIQUE INDEX IF NOT EXISTS ux_mst_bp_contact_primary ON mst_bp_contact (BpId) NULLS NOT DISTINCT WHERE IsPrimary = true AND IsActive = true;
CREATE UNIQUE INDEX IF NOT EXISTS ux_mst_bp_bank_account_primary ON mst_bp_bank_account (BpId, CurrencyCode) NULLS NOT DISTINCT WHERE IsPrimary = true AND IsActive = true;
-- at most one accepted and one pending version per legal document type
CREATE INDEX IF NOT EXISTS ix_mst_bp_document_expiry ON mst_bp_document (ExpiryDate) WHERE Status = 'ACCEPTED' AND ExpiryDate IS NOT NULL;
-- invoice lookups used by the bank (MUFG) callback
CREATE INDEX IF NOT EXISTS ix_tr_ap_invoice_documentreference ON tr_ap_invoice (DocumentReference) WHERE DocumentReference IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tr_ap_invoice_legacyinvoiceno ON tr_ap_invoice (LegacyInvoiceNo) WHERE LegacyInvoiceNo IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_tr_document_docno ON tr_document (DocType, DocNo) NULLS NOT DISTINCT WHERE DocNo IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_mst_company_bank_account_no ON mst_company_bank_account (BankId, AccountNo) NULLS NOT DISTINCT WHERE AccountNo IS NOT NULL;
-- one latest quotation per RFQ participant
CREATE UNIQUE INDEX IF NOT EXISTS ux_tr_quotation_latest ON tr_quotation (RfqParticipantId) NULLS NOT DISTINCT WHERE IsLatest = true;
-- no double billing; Faktur Pajak unique nationally
CREATE UNIQUE INDEX IF NOT EXISTS ux_tr_ap_invoice_bpinvoiceno ON tr_ap_invoice (BpId, BpInvoiceNo) NULLS NOT DISTINCT WHERE IsVoid = false;
CREATE UNIQUE INDEX IF NOT EXISTS ux_tr_ap_invoice_taxinvoiceno ON tr_ap_invoice (TaxInvoiceNo) NULLS NOT DISTINCT WHERE TaxInvoiceNo IS NOT NULL AND IsVoid = false;
-- one live settlement per cash advance (old rule lived only in a dropdown query)
CREATE UNIQUE INDEX IF NOT EXISTS ux_tr_settlement_oneperadvance ON tr_settlement (CashAdvanceId) NULLS NOT DISTINCT WHERE IsVoid = false;
-- Faktur Pajak keluaran unique
CREATE UNIQUE INDEX IF NOT EXISTS ux_tr_ar_invoice_taxinvoiceno ON tr_ar_invoice (TaxInvoiceNo) NULLS NOT DISTINCT WHERE TaxInvoiceNo IS NOT NULL AND IsVoid = false;
-- a journal can be reversed only once
CREATE UNIQUE INDEX IF NOT EXISTS ux_tr_journal_entry_reversal ON tr_journal_entry (ReversalOfId) NULLS NOT DISTINCT WHERE ReversalOfId IS NOT NULL;
-- one active account-determination rule per role + filter combination (NULLs compare equal here)
-- one active budget per year / department / purchase class (NULL class = whole department)
CREATE UNIQUE INDEX IF NOT EXISTS ux_mst_budget_scope ON mst_budget (FiscalYear, DepartmentId, PurchaseClassId) NULLS NOT DISTINCT WHERE IsActive = true;
CREATE UNIQUE INDEX IF NOT EXISTS ux_mst_account_determination_rule ON mst_account_determination (AccountRole, TaxCodeId, CategoryId, PurchaseClassId, CurrencyCode) NULLS NOT DISTINCT WHERE IsActive = true;
-- one primary payout account per employee
CREATE UNIQUE INDEX IF NOT EXISTS ux_mst_employee_bank_account_primary ON mst_employee_bank_account (EmployeeUserId, CurrencyCode) NULLS NOT DISTINCT WHERE IsPrimary = true AND IsActive = true;
-- idempotent bank (MUFG) callbacks
CREATE UNIQUE INDEX IF NOT EXISTS ux_tr_payment_bankreference ON tr_payment (BankReference) NULLS NOT DISTINCT WHERE BankReference IS NOT NULL;
-- a new task is created by at most one reassignment item
CREATE UNIQUE INDEX IF NOT EXISTS ux_tr_approval_reassignment_item_new ON tr_approval_reassignment_item (NewTaskId) NULLS NOT DISTINCT WHERE NewTaskId IS NOT NULL;
-- one live task per person per step (a task can later move back to someone who held it before)
CREATE UNIQUE INDEX IF NOT EXISTS ux_tr_approval_task_liveassignee ON tr_approval_task (ApprovalRequestId, StepNo, AssigneeUserId) NULLS NOT DISTINCT WHERE Status NOT IN ('REASSIGNED','CANCELLED');
-- a reassigned task is taken over by exactly one new task
CREATE UNIQUE INDEX IF NOT EXISTS ux_tr_approval_task_replaces ON tr_approval_task (ReplacesTaskId) NULLS NOT DISTINCT WHERE ReplacesTaskId IS NOT NULL;
-- only one approval round running per document; approver inbox
CREATE UNIQUE INDEX IF NOT EXISTS ux_tr_approval_request_onepending ON tr_approval_request (DocumentId) NULLS NOT DISTINCT WHERE Status = 'PENDING';
