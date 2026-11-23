-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "mst_user" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "UserType" VARCHAR(10) NOT NULL,
    "Email" VARCHAR(254) NOT NULL,
    "DisplayName" VARCHAR(150) NOT NULL,
    "Phone" VARCHAR(30),
    "SignatureFileId" BIGINT,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "StatusReason" VARCHAR(500),
    "EmailVerifiedAt" TIMESTAMPTZ(3),
    "LastLoginAt" TIMESTAMPTZ(3),
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_user_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "sys_user_credential" (
    "UserId" BIGINT NOT NULL,
    "AuthProvider" VARCHAR(20) NOT NULL DEFAULT 'LOCAL',
    "ExternalAuthId" VARCHAR(200),
    "PasswordHash" VARCHAR(255),
    "PasswordChangedAt" TIMESTAMPTZ(3),
    "FailedLoginCount" SMALLINT NOT NULL DEFAULT 0,
    "LockoutCount" SMALLINT NOT NULL DEFAULT 0,
    "LockoutUntil" TIMESTAMPTZ(3),
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_user_credential_pkey" PRIMARY KEY ("UserId")
);

-- CreateTable
CREATE TABLE "mst_role" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(50) NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Scope" VARCHAR(10) NOT NULL,
    "Description" VARCHAR(255),
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_role_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_permission" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(80) NOT NULL,
    "Module" VARCHAR(30) NOT NULL,
    "Name" VARCHAR(150) NOT NULL,

    CONSTRAINT "mst_permission_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_role_permission" (
    "RoleId" INTEGER NOT NULL,
    "PermissionId" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,

    CONSTRAINT "mst_role_permission_pkey" PRIMARY KEY ("RoleId","PermissionId")
);

-- CreateTable
CREATE TABLE "mst_user_role" (
    "UserId" BIGINT NOT NULL,
    "RoleId" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,

    CONSTRAINT "mst_user_role_pkey" PRIMARY KEY ("UserId","RoleId")
);

-- CreateTable
CREATE TABLE "mst_department" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(20) NOT NULL,
    "Name" VARCHAR(150) NOT NULL,
    "ParentId" INTEGER,
    "HeadUserId" BIGINT,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_department_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_cost_center" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(20) NOT NULL,
    "Name" VARCHAR(150) NOT NULL,
    "DepartmentId" INTEGER,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_cost_center_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_employee" (
    "UserId" BIGINT NOT NULL,
    "UserType" VARCHAR(10) NOT NULL DEFAULT 'INTERNAL',
    "EmployeeNo" VARCHAR(30) NOT NULL,
    "DepartmentId" INTEGER NOT NULL,
    "JobTitle" VARCHAR(100),
    "SuperiorUserId" BIGINT,
    "JoinDate" DATE,
    "EndDate" DATE,
    "EndReason" VARCHAR(15),
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_employee_pkey" PRIMARY KEY ("UserId")
);

-- CreateTable
CREATE TABLE "mst_currency" (
    "Code" CHAR(3) NOT NULL,
    "NumericCode" CHAR(3) NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Symbol" VARCHAR(10),
    "Decimals" SMALLINT NOT NULL DEFAULT 2,
    "IsFund" BOOLEAN NOT NULL DEFAULT false,
    "IsActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "mst_currency_pkey" PRIMARY KEY ("Code")
);

-- CreateTable
CREATE TABLE "mst_exchange_rate" (
    "CurrencyCode" CHAR(3) NOT NULL,
    "RateType" VARCHAR(10) NOT NULL,
    "RateDate" DATE NOT NULL,
    "RateToBase" DECIMAL(18,6) NOT NULL,
    "Source" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,

    CONSTRAINT "mst_exchange_rate_pkey" PRIMARY KEY ("CurrencyCode","RateType","RateDate")
);

-- CreateTable
CREATE TABLE "mst_tax_code" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(20) NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "TaxType" VARCHAR(3) NOT NULL,
    "RatePercent" DECIMAL(7,4) NOT NULL,
    "EffectiveFrom" DATE NOT NULL,
    "EffectiveTo" DATE,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_tax_code_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_payment_term" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(20) NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "DueDays" SMALLINT NOT NULL,
    "BaselineDate" VARCHAR(15) NOT NULL DEFAULT 'INVOICE_DATE',
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,

    CONSTRAINT "mst_payment_term_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_uom" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(10) NOT NULL,
    "Name" VARCHAR(50) NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,

    CONSTRAINT "mst_uom_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_category" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(30) NOT NULL,
    "Name" VARCHAR(150) NOT NULL,
    "ParentId" INTEGER,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_category_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_purchase_class" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(20) NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "IsAsset" BOOLEAN NOT NULL DEFAULT false,
    "InvoicePriceTolerancePct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,

    CONSTRAINT "mst_purchase_class_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_item" (
    "Id" BIGSERIAL NOT NULL,
    "Code" VARCHAR(30) NOT NULL,
    "Name" VARCHAR(200) NOT NULL,
    "Description" VARCHAR(1000),
    "ItemType" VARCHAR(10) NOT NULL,
    "CategoryId" INTEGER NOT NULL,
    "UomId" INTEGER NOT NULL,
    "PurchaseUomId" INTEGER,
    "PackSize" DECIMAL(18,6),
    "VatTaxCodeId" INTEGER,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_item_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_form_note" (
    "Id" SERIAL NOT NULL,
    "UserId" BIGINT,
    "DocType" VARCHAR(3) NOT NULL,
    "Body" VARCHAR(4000) NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_form_note_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_expense_category" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(30) NOT NULL,
    "Name" VARCHAR(150) NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,

    CONSTRAINT "mst_expense_category_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_remark_template" (
    "Id" SERIAL NOT NULL,
    "Module" VARCHAR(5) NOT NULL,
    "Text" VARCHAR(300) NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,

    CONSTRAINT "mst_remark_template_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_bank" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(20) NOT NULL,
    "Name" VARCHAR(150) NOT NULL,
    "SwiftCode" VARCHAR(11),
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,

    CONSTRAINT "mst_bank_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_status_transition" (
    "DocType" VARCHAR(3) NOT NULL,
    "FromStatus" VARCHAR(20) NOT NULL,
    "ToStatus" VARCHAR(20) NOT NULL,
    "RequiredApproval" VARCHAR(10),
    "AllowBp" BOOLEAN NOT NULL DEFAULT false,
    "Description" VARCHAR(200),

    CONSTRAINT "mst_status_transition_pkey" PRIMARY KEY ("DocType","FromStatus","ToStatus")
);

-- CreateTable
CREATE TABLE "mst_bp_document_type" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(30) NOT NULL,
    "Name" VARCHAR(150) NOT NULL,
    "AppliesTo" VARCHAR(10) NOT NULL DEFAULT 'ALL',
    "IsMandatory" BOOLEAN NOT NULL DEFAULT false,
    "HasExpiry" BOOLEAN NOT NULL DEFAULT false,
    "AllowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,

    CONSTRAINT "mst_bp_document_type_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_coa" (
    "Id" SERIAL NOT NULL,
    "AccountCode" VARCHAR(20) NOT NULL,
    "AccountName" VARCHAR(200) NOT NULL,
    "AccountType" VARCHAR(10),
    "ParentId" INTEGER,
    "IsPostable" BOOLEAN NOT NULL DEFAULT true,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_coa_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_transaction_type" (
    "Id" SERIAL NOT NULL,
    "Module" VARCHAR(5) NOT NULL,
    "Code" VARCHAR(10) NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "RequiresSettlement" BOOLEAN NOT NULL DEFAULT true,
    "RequiresClose" BOOLEAN NOT NULL DEFAULT false,
    "ControlCoaId" INTEGER,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,

    CONSTRAINT "mst_transaction_type_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_expense_account" (
    "Id" SERIAL NOT NULL,
    "Module" VARCHAR(5) NOT NULL,
    "TransactionTypeId" INTEGER,
    "DepartmentId" INTEGER,
    "ExpenseCategoryId" INTEGER NOT NULL,
    "CoaId" INTEGER NOT NULL,
    "Remarks" VARCHAR(300),
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_expense_account_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_budget" (
    "Id" SERIAL NOT NULL,
    "FiscalYear" SMALLINT NOT NULL,
    "DepartmentId" INTEGER NOT NULL,
    "PurchaseClassId" INTEGER,
    "Amount" DECIMAL(19,2) NOT NULL,
    "ControlMode" VARCHAR(5) NOT NULL DEFAULT 'BLOCK',
    "Remarks" VARCHAR(300),
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_budget_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_posting_period" (
    "PeriodKey" CHAR(6) NOT NULL,
    "Status" VARCHAR(10) NOT NULL DEFAULT 'OPEN',
    "ClosedAt" TIMESTAMPTZ(3),
    "ClosedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_posting_period_pkey" PRIMARY KEY ("PeriodKey")
);

-- CreateTable
CREATE TABLE "mst_account_determination" (
    "Id" SERIAL NOT NULL,
    "AccountRole" VARCHAR(20) NOT NULL,
    "TaxCodeId" INTEGER,
    "CategoryId" INTEGER,
    "PurchaseClassId" INTEGER,
    "CurrencyCode" CHAR(3),
    "CoaId" INTEGER NOT NULL,
    "Remarks" VARCHAR(300),
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_account_determination_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_company_bank_account" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(20) NOT NULL,
    "AccountKind" VARCHAR(5) NOT NULL DEFAULT 'BANK',
    "BankId" INTEGER,
    "AccountNo" VARCHAR(34),
    "AccountName" VARCHAR(150) NOT NULL,
    "CurrencyCode" CHAR(3) NOT NULL,
    "CoaId" INTEGER NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,

    CONSTRAINT "mst_company_bank_account_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_employee_bank_account" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "EmployeeUserId" BIGINT NOT NULL,
    "BankId" INTEGER NOT NULL,
    "AccountNo" VARCHAR(34) NOT NULL,
    "AccountHolderName" VARCHAR(150) NOT NULL,
    "CurrencyCode" CHAR(3) NOT NULL DEFAULT 'IDR',
    "VerificationStatus" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "VerifiedAt" TIMESTAMPTZ(3),
    "VerifiedBy" BIGINT,
    "IsPrimary" BOOLEAN NOT NULL DEFAULT false,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_employee_bank_account_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_approver_mapping" (
    "Id" SERIAL NOT NULL,
    "PreparerUserId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL,
    "TransactionTypeId" INTEGER,
    "PaymentPurpose" VARCHAR(20),
    "StepCode" VARCHAR(5) NOT NULL,
    "ApproverUserId" BIGINT NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_approver_mapping_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_business_partner" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "BpCode" VARCHAR(20),
    "IsSupplier" BOOLEAN NOT NULL DEFAULT false,
    "IsCustomer" BOOLEAN NOT NULL DEFAULT false,
    "EntityType" VARCHAR(10) NOT NULL,
    "LegalName" VARCHAR(200) NOT NULL,
    "TradeName" VARCHAR(200),
    "TaxId" VARCHAR(20),
    "BusinessRegNo" VARCHAR(20),
    "IsVatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "CountryCode" CHAR(2) NOT NULL DEFAULT 'ID',
    "Email" VARCHAR(254),
    "Phone" VARCHAR(30),
    "Fax" VARCHAR(30),
    "GroupName" VARCHAR(100),
    "Website" VARCHAR(200),
    "DefaultCurrencyCode" CHAR(3) NOT NULL DEFAULT 'IDR',
    "PaymentTermId" INTEGER,
    "ApControlCoaId" INTEGER,
    "ArControlCoaId" INTEGER,
    "DownPaymentCoaId" INTEGER,
    "DefaultVatTaxCodeId" INTEGER,
    "DefaultWhtTaxCodeId" INTEGER,
    "OnboardingStatus" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "OperationalStatus" VARCHAR(15) NOT NULL DEFAULT 'INACTIVE',
    "OperationalReason" VARCHAR(500),
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "FirstApprovedAt" TIMESTAMPTZ(3),
    "Source" VARCHAR(15) NOT NULL DEFAULT 'SELF_REGISTERED',
    "LegacyCode" VARCHAR(30),
    "Version" INTEGER NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_business_partner_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_bp_address" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "BpId" BIGINT NOT NULL,
    "AddressType" VARCHAR(10) NOT NULL,
    "Line1" VARCHAR(200) NOT NULL,
    "Line2" VARCHAR(200),
    "City" VARCHAR(100) NOT NULL,
    "Province" VARCHAR(100),
    "PostalCode" VARCHAR(10),
    "CountryCode" CHAR(2) NOT NULL DEFAULT 'ID',
    "IsPrimary" BOOLEAN NOT NULL DEFAULT false,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_bp_address_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_bp_contact" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "BpId" BIGINT NOT NULL,
    "Name" VARCHAR(150) NOT NULL,
    "Position" VARCHAR(100),
    "Email" VARCHAR(254),
    "Phone" VARCHAR(30),
    "IsPrimary" BOOLEAN NOT NULL DEFAULT false,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_bp_contact_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_bp_bank_account" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "BpId" BIGINT NOT NULL,
    "BankId" INTEGER NOT NULL,
    "AccountNo" VARCHAR(34) NOT NULL,
    "AccountHolderName" VARCHAR(150) NOT NULL,
    "BranchName" VARCHAR(100),
    "CurrencyCode" CHAR(3) NOT NULL DEFAULT 'IDR',
    "ProofFileId" BIGINT,
    "VerificationStatus" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "VerifiedAt" TIMESTAMPTZ(3),
    "VerifiedBy" BIGINT,
    "IsPrimary" BOOLEAN NOT NULL DEFAULT false,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,
    "Iban" VARCHAR(34),
    "BeneficiaryAddress" VARCHAR(300),
    "IsResident" BOOLEAN NOT NULL DEFAULT true,
    "BeneficiaryType" VARCHAR(10),
    "Relationship" VARCHAR(50),
    "RemittancePurpose" VARCHAR(100),
    "VirtualAccountNo" VARCHAR(50),
    "VirtualAccountName" VARCHAR(200),
    "BeneficiaryCountry" CHAR(2),
    "BeneficiaryCity" VARCHAR(100),
    "BankAddress" VARCHAR(500),
    "BankCity" VARCHAR(100),
    "BankCountry" CHAR(2),
    "Citizenship" VARCHAR(20),
    "PaymentTypeMufg" VARCHAR(30),
    "ExchangeMethod" VARCHAR(30),
    "RemittanceNote1" VARCHAR(500),
    "RemittanceNote2" VARCHAR(500),

    CONSTRAINT "mst_bp_bank_account_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_bp_category" (
    "BpId" BIGINT NOT NULL,
    "CategoryId" INTEGER NOT NULL,
    "Status" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "DecidedAt" TIMESTAMPTZ(3),
    "DecidedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,

    CONSTRAINT "mst_bp_category_pkey" PRIMARY KEY ("BpId","CategoryId")
);

-- CreateTable
CREATE TABLE "mst_bp_user" (
    "BpId" BIGINT NOT NULL,
    "UserId" BIGINT NOT NULL,
    "UserType" VARCHAR(10) NOT NULL DEFAULT 'BP',
    "AccessRole" VARCHAR(10) NOT NULL DEFAULT 'STAFF',
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_bp_user_pkey" PRIMARY KEY ("BpId","UserId")
);

-- CreateTable
CREATE TABLE "mst_bp_internal_pic" (
    "BpId" BIGINT NOT NULL,
    "UserId" BIGINT NOT NULL,
    "UserType" VARCHAR(10) NOT NULL DEFAULT 'INTERNAL',
    "PicRole" VARCHAR(20) NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "Notes" VARCHAR(500),
    "UpdatedAt" TIMESTAMPTZ(3),
    "UpdatedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,

    CONSTRAINT "mst_bp_internal_pic_pkey" PRIMARY KEY ("BpId","UserId","PicRole")
);

-- CreateTable
CREATE TABLE "mst_bp_document" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "BpId" BIGINT NOT NULL,
    "DocumentTypeId" INTEGER NOT NULL,
    "VersionNo" SMALLINT NOT NULL,
    "FileId" BIGINT NOT NULL,
    "DocumentNo" VARCHAR(100),
    "IssuedDate" DATE,
    "ExpiryDate" DATE,
    "Status" VARCHAR(15) NOT NULL DEFAULT 'PENDING_REVIEW',
    "VerificationId" BIGINT,
    "ReviewedBy" BIGINT,
    "ReviewedAt" TIMESTAMPTZ(3),
    "ReviewRemarks" VARCHAR(1000),
    "Description" VARCHAR(500),
    "RemovedAt" TIMESTAMPTZ(3),
    "RemovedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT NOT NULL,

    CONSTRAINT "mst_bp_document_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_approval_template" (
    "Id" SERIAL NOT NULL,
    "Code" VARCHAR(30) NOT NULL,
    "Name" VARCHAR(150) NOT NULL,
    "DocType" VARCHAR(3) NOT NULL,
    "Priority" SMALLINT NOT NULL DEFAULT 100,
    "MinAmountBase" DECIMAL(19,2),
    "MaxAmountBase" DECIMAL(19,2),
    "DepartmentId" INTEGER,
    "PurchaseClassId" INTEGER,
    "TransactionTypeId" INTEGER,
    "PaymentPurpose" VARCHAR(20),
    "EffectiveFrom" DATE NOT NULL,
    "EffectiveTo" DATE,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_approval_template_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_approval_template_step" (
    "Id" SERIAL NOT NULL,
    "TemplateId" INTEGER NOT NULL,
    "StepNo" SMALLINT NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "StepCode" VARCHAR(5),
    "ApproverType" VARCHAR(15) NOT NULL,
    "ApproverUserId" BIGINT,
    "ApproverRoleId" INTEGER,
    "PicRole" VARCHAR(20),
    "RequiredApprovals" SMALLINT NOT NULL DEFAULT 1,
    "IsOptional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "mst_approval_template_step_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_approval_delegation" (
    "Id" BIGSERIAL NOT NULL,
    "FromUserId" BIGINT NOT NULL,
    "ToUserId" BIGINT NOT NULL,
    "DocType" VARCHAR(3),
    "DocumentId" BIGINT,
    "StartsAt" TIMESTAMPTZ(3) NOT NULL,
    "EndsAt" TIMESTAMPTZ(3) NOT NULL,
    "Reason" VARCHAR(300),
    "RevokedAt" TIMESTAMPTZ(3),
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT NOT NULL,

    CONSTRAINT "mst_approval_delegation_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "mst_approval_backup" (
    "Id" BIGSERIAL NOT NULL,
    "ApproverUserId" BIGINT NOT NULL,
    "BackupUserId" BIGINT NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "Notes" VARCHAR(500),
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "mst_approval_backup_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_document" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "DocType" VARCHAR(3) NOT NULL,
    "DocNo" VARCHAR(30),
    "DocDate" DATE NOT NULL,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "Title" VARCHAR(200),
    "BpId" BIGINT,
    "DepartmentId" INTEGER,
    "OwnerUserId" BIGINT NOT NULL,
    "CurrencyCode" CHAR(3),
    "ExchangeRate" DECIMAL(18,6),
    "ExchangeRateDate" DATE,
    "TotalAmount" DECIMAL(19,2),
    "TotalAmountBase" DECIMAL(19,2),
    "AppliedAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "Remarks" VARCHAR(2000),
    "SubmittedAt" TIMESTAMPTZ(3),
    "CancelledAt" TIMESTAMPTZ(3),
    "CancelReason" VARCHAR(500),
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "DeletedAt" TIMESTAMPTZ(3),
    "DeletedBy" BIGINT,
    "DeleteReason" VARCHAR(500),
    "Version" INTEGER NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "tr_document_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_document_attachment" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "DocumentId" BIGINT NOT NULL,
    "FileId" BIGINT NOT NULL,
    "Category" VARCHAR(20) NOT NULL,
    "Description" VARCHAR(500),
    "Visibility" VARCHAR(10) NOT NULL DEFAULT 'SHARED',
    "SigningStatus" VARCHAR(10) NOT NULL DEFAULT 'NONE',
    "SignedFileId" BIGINT,
    "StampStatus" VARCHAR(10) NOT NULL DEFAULT 'NONE',
    "StampedFileId" BIGINT,
    "ExternalJobRef" VARCHAR(100),
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT NOT NULL,
    "RemovedAt" TIMESTAMPTZ(3),
    "RemovedBy" BIGINT,

    CONSTRAINT "tr_document_attachment_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_document_comment" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "DocumentId" BIGINT NOT NULL,
    "AuthorUserId" BIGINT NOT NULL,
    "Body" VARCHAR(4000) NOT NULL,
    "Visibility" VARCHAR(10) NOT NULL DEFAULT 'INTERNAL',
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tr_document_comment_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_bp_verification" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'SVR',
    "RequestType" VARCHAR(15) NOT NULL,
    "ReviewerUserId" BIGINT,
    "ReviewStartedAt" TIMESTAMPTZ(3),
    "ReviewCompletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "tr_bp_verification_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_bp_verification_check" (
    "Id" BIGSERIAL NOT NULL,
    "VerificationId" BIGINT NOT NULL,
    "CheckArea" VARCHAR(15) NOT NULL,
    "BpDocumentId" BIGINT,
    "Result" VARCHAR(5) NOT NULL,
    "Remarks" VARCHAR(1000),
    "CheckedBy" BIGINT NOT NULL,
    "CheckedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tr_bp_verification_check_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_bp_profile_change" (
    "Id" BIGSERIAL NOT NULL,
    "VerificationId" BIGINT NOT NULL,
    "FieldName" VARCHAR(50) NOT NULL,
    "OldValue" VARCHAR(500),
    "NewValue" VARCHAR(500),
    "AppliedAt" TIMESTAMPTZ(3),

    CONSTRAINT "tr_bp_profile_change_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_purchase_request" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'PR',
    "RequiredDate" DATE NOT NULL,
    "PurchaseClassId" INTEGER NOT NULL,
    "CostCenterId" INTEGER,
    "SourcingMethod" VARCHAR(10) NOT NULL DEFAULT 'DIRECT',
    "Justification" VARCHAR(2000),

    CONSTRAINT "tr_purchase_request_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_purchase_request_line" (
    "Id" BIGSERIAL NOT NULL,
    "PurchaseRequestId" BIGINT NOT NULL,
    "LineNum" SMALLINT NOT NULL,
    "ItemId" BIGINT,
    "Description" VARCHAR(500) NOT NULL,
    "Detail" VARCHAR(2000),
    "Purpose" VARCHAR(500),
    "CategoryId" INTEGER,
    "UomId" INTEGER NOT NULL,
    "Quantity" DECIMAL(18,4) NOT NULL,
    "EstimatedUnitPrice" DECIMAL(19,4),
    "RequiredDate" DATE,
    "EtaDate" DATE,
    "InventoryQty" DECIMAL(18,4),
    "InventoryUomId" INTEGER,
    "SuggestedBpId" BIGINT,
    "CostCenterId" INTEGER,
    "OrderedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "LineStatus" VARCHAR(10) NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "tr_purchase_request_line_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_rfq" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'RFQ',
    "SubmissionDeadline" TIMESTAMPTZ(3) NOT NULL,
    "QuoteValidityDays" SMALLINT,
    "EvaluationMethod" VARCHAR(15) NOT NULL DEFAULT 'LOWEST_PRICE',
    "Terms" VARCHAR(4000),
    "PublishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "tr_rfq_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_rfq_line" (
    "Id" BIGSERIAL NOT NULL,
    "RfqId" BIGINT NOT NULL,
    "LineNum" SMALLINT NOT NULL,
    "PurchaseRequestLineId" BIGINT,
    "ItemId" BIGINT,
    "Description" VARCHAR(500) NOT NULL,
    "CategoryId" INTEGER NOT NULL,
    "UomId" INTEGER NOT NULL,
    "Quantity" DECIMAL(18,4) NOT NULL,
    "RequiredDate" DATE,
    "Specification" VARCHAR(2000),

    CONSTRAINT "tr_rfq_line_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_rfq_participant" (
    "Id" BIGSERIAL NOT NULL,
    "RfqId" BIGINT NOT NULL,
    "BpId" BIGINT NOT NULL,
    "InvitationStatus" VARCHAR(10) NOT NULL DEFAULT 'INVITED',
    "InvitedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "InvitedBy" BIGINT NOT NULL,
    "ViewedAt" TIMESTAMPTZ(3),
    "RespondedAt" TIMESTAMPTZ(3),
    "DeclineReason" VARCHAR(500),

    CONSTRAINT "tr_rfq_participant_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_quotation" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'QUO',
    "RfqParticipantId" BIGINT NOT NULL,
    "RevisionNo" SMALLINT NOT NULL DEFAULT 1,
    "IsLatest" BOOLEAN NOT NULL DEFAULT true,
    "BpReference" VARCHAR(50),
    "ValidUntil" DATE,
    "PaymentTermId" INTEGER,
    "DeliveryTerms" VARCHAR(200),
    "EvaluationScore" DECIMAL(5,2),
    "EvaluationRank" SMALLINT,
    "EvaluationRemarks" VARCHAR(1000),
    "EvaluatedBy" BIGINT,
    "EvaluatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "tr_quotation_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_quotation_line" (
    "Id" BIGSERIAL NOT NULL,
    "QuotationId" BIGINT NOT NULL,
    "RfqLineId" BIGINT NOT NULL,
    "Quantity" DECIMAL(18,4) NOT NULL,
    "UnitPrice" DECIMAL(19,4) NOT NULL,
    "DiscountPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "VatTaxCodeId" INTEGER,
    "LineAmount" DECIMAL(19,2) NOT NULL,
    "LeadTimeDays" SMALLINT,
    "Remarks" VARCHAR(500),
    "AwardedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "tr_quotation_line_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_purchase_order" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'PO',
    "QuotationId" BIGINT,
    "ContractId" BIGINT,
    "RevisionNo" SMALLINT NOT NULL DEFAULT 0,
    "PurchaseClassId" INTEGER NOT NULL,
    "PaymentTermId" INTEGER NOT NULL,
    "PaymentTermsText" VARCHAR(500),
    "PoType" VARCHAR(20),
    "BpReference" VARCHAR(100),
    "ShippingMethod" VARCHAR(50),
    "DeliveryDate" DATE,
    "EtaDate" DATE,
    "DeliveryAddress" VARCHAR(500),
    "BpContactId" BIGINT,
    "SubtotalAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "DiscountAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "FreightAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "VatAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "GrandTotal" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "IssuedAt" TIMESTAMPTZ(3),
    "AcknowledgedAt" TIMESTAMPTZ(3),
    "AcknowledgedBy" BIGINT,

    CONSTRAINT "tr_purchase_order_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_purchase_order_line" (
    "Id" BIGSERIAL NOT NULL,
    "PurchaseOrderId" BIGINT NOT NULL,
    "LineNum" SMALLINT NOT NULL,
    "PurchaseRequestLineId" BIGINT,
    "QuotationLineId" BIGINT,
    "ContractLineId" BIGINT,
    "ItemId" BIGINT,
    "Description" VARCHAR(500) NOT NULL,
    "Detail" VARCHAR(2000),
    "UomId" INTEGER NOT NULL,
    "Quantity" DECIMAL(18,4) NOT NULL,
    "UnitPrice" DECIMAL(19,4) NOT NULL,
    "PackSize" DECIMAL(18,6),
    "InventoryUomId" INTEGER,
    "InventoryQty" DECIMAL(18,4),
    "PricePerInventoryUnit" DECIMAL(19,6),
    "DiscountPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "VatTaxCodeId" INTEGER,
    "LineAmount" DECIMAL(19,2) NOT NULL,
    "VatAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "DeliveryDate" DATE,
    "CostCenterId" INTEGER,
    "ReceivedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "InvoicedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "LineStatus" VARCHAR(10) NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "tr_purchase_order_line_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_purchase_contract" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'CTR',
    "AgreementType" VARCHAR(8) NOT NULL DEFAULT 'QUANTITY',
    "StartDate" DATE NOT NULL,
    "EndDate" DATE NOT NULL,
    "TargetAmount" DECIMAL(19,2),
    "PurchaseClassId" INTEGER NOT NULL,
    "PaymentTermId" INTEGER NOT NULL,
    "BpReference" VARCHAR(100),
    "Terms" VARCHAR(4000),

    CONSTRAINT "tr_purchase_contract_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_purchase_contract_line" (
    "Id" BIGSERIAL NOT NULL,
    "ContractId" BIGINT NOT NULL,
    "LineNum" SMALLINT NOT NULL,
    "ItemId" BIGINT,
    "CategoryId" INTEGER,
    "Description" VARCHAR(500) NOT NULL,
    "UomId" INTEGER NOT NULL,
    "TargetQty" DECIMAL(18,4),
    "UnitPrice" DECIMAL(19,4) NOT NULL,
    "DiscountPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "VatTaxCodeId" INTEGER,

    CONSTRAINT "tr_purchase_contract_line_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_landed_cost" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "GoodsReceiptId" BIGINT NOT NULL,
    "CostType" VARCHAR(15) NOT NULL,
    "Description" VARCHAR(300),
    "SourceInvoiceId" BIGINT,
    "CurrencyCode" CHAR(3) NOT NULL,
    "Amount" DECIMAL(19,2) NOT NULL,
    "ExchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "AmountBase" DECIMAL(19,2) NOT NULL,
    "AllocationMethod" VARCHAR(8) NOT NULL DEFAULT 'VALUE',
    "IsCapitalized" BOOLEAN NOT NULL DEFAULT true,
    "Status" VARCHAR(10) NOT NULL DEFAULT 'DRAFT',
    "PostedAt" TIMESTAMPTZ(3),
    "PostedBy" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,
    "UpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" BIGINT,

    CONSTRAINT "tr_landed_cost_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_landed_cost_allocation" (
    "LandedCostId" BIGINT NOT NULL,
    "GoodsReceiptLineId" BIGINT NOT NULL,
    "AmountBase" DECIMAL(19,2) NOT NULL,

    CONSTRAINT "tr_landed_cost_allocation_pkey" PRIMARY KEY ("LandedCostId","GoodsReceiptLineId")
);

-- CreateTable
CREATE TABLE "tr_goods_receipt" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'GR',
    "ReceiptKind" VARCHAR(7) NOT NULL DEFAULT 'RECEIPT',
    "ReturnReason" VARCHAR(500),
    "PurchaseOrderId" BIGINT NOT NULL,
    "ReceivedDate" DATE NOT NULL,
    "ReceivedBy" BIGINT NOT NULL,
    "DeliveryNoteNo" VARCHAR(50),
    "VehiclePlateNo" VARCHAR(15),
    "DriverName" VARCHAR(100),
    "DriverPhone" VARCHAR(20),
    "CarrierName" VARCHAR(100),
    "Location" VARCHAR(100),

    CONSTRAINT "tr_goods_receipt_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_goods_receipt_line" (
    "Id" BIGSERIAL NOT NULL,
    "GoodsReceiptId" BIGINT NOT NULL,
    "LineNum" SMALLINT NOT NULL,
    "PurchaseOrderLineId" BIGINT NOT NULL,
    "ReceivedQty" DECIMAL(18,4) NOT NULL,
    "AcceptedQty" DECIMAL(18,4) NOT NULL,
    "RejectedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "RejectReason" VARCHAR(500),
    "ReturnOfLineId" BIGINT,

    CONSTRAINT "tr_goods_receipt_line_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_receipt_acceptance" (
    "Id" BIGSERIAL NOT NULL,
    "GoodsReceiptId" BIGINT NOT NULL,
    "AcceptanceType" VARCHAR(5) NOT NULL,
    "ReferenceNo" VARCHAR(50),
    "SignatoryName" VARCHAR(100) NOT NULL,
    "SignatoryPosition" VARCHAR(100),
    "Area" VARCHAR(100),
    "Result" VARCHAR(12) NOT NULL,
    "SignedAt" TIMESTAMPTZ(3) NOT NULL,
    "Remarks" VARCHAR(500),
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT NOT NULL,

    CONSTRAINT "tr_receipt_acceptance_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_ap_invoice" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'INV',
    "InvoiceKind" VARCHAR(12) NOT NULL DEFAULT 'INVOICE',
    "OriginalInvoiceId" BIGINT,
    "BpId" BIGINT NOT NULL,
    "PurchaseOrderId" BIGINT,
    "BpInvoiceNo" VARCHAR(50) NOT NULL,
    "DocumentReference" VARCHAR(100),
    "LegacyInvoiceNo" VARCHAR(50),
    "ReceiverUserId" BIGINT,
    "TaxInvoiceNo" VARCHAR(30),
    "InvoiceDate" DATE NOT NULL,
    "ReceivedDate" DATE,
    "DueDate" DATE,
    "TransactionAmount" DECIMAL(19,2) NOT NULL,
    "DownPaymentAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "TaxBaseAmount" DECIMAL(19,2) NOT NULL,
    "VatTaxCodeId" INTEGER,
    "VatAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "WhtTaxCodeId" INTEGER,
    "WhtBaseAmount" DECIMAL(19,2),
    "WhtBaseDescription" VARCHAR(255),
    "WhtAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "TaxExchangeRate" DECIMAL(18,6),
    "VatAmountBase" DECIMAL(19,0),
    "WhtAmountBase" DECIMAL(19,0),
    "NetPayable" DECIMAL(19,2) NOT NULL,
    "IsVoid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tr_ap_invoice_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_ap_invoice_line" (
    "Id" BIGSERIAL NOT NULL,
    "InvoiceId" BIGINT NOT NULL,
    "LineNum" SMALLINT NOT NULL,
    "PurchaseOrderLineId" BIGINT,
    "GoodsReceiptLineId" BIGINT,
    "Description" VARCHAR(500) NOT NULL,
    "Quantity" DECIMAL(18,4) NOT NULL,
    "UnitPrice" DECIMAL(19,4) NOT NULL,
    "LineAmount" DECIMAL(19,2) NOT NULL,
    "CoaId" INTEGER,
    "CostCenterId" INTEGER,
    "VatTaxCodeId" INTEGER,
    "VatAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "WhtTaxCodeId" INTEGER,
    "WhtBaseAmount" DECIMAL(19,2),
    "WhtAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,

    CONSTRAINT "tr_ap_invoice_line_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_ap_down_payment_application" (
    "Id" BIGSERIAL NOT NULL,
    "InvoiceId" BIGINT NOT NULL,
    "DownPaymentInvoiceId" BIGINT NOT NULL,
    "Amount" DECIMAL(19,2) NOT NULL,

    CONSTRAINT "tr_ap_down_payment_application_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_payment" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'PAY',
    "Purpose" VARCHAR(20) NOT NULL,
    "PayeeType" VARCHAR(10) NOT NULL,
    "BpBankAccountId" BIGINT,
    "EmployeeBankAccountId" BIGINT,
    "CompanyBankAccountId" INTEGER NOT NULL,
    "PaymentMethod" VARCHAR(10) NOT NULL DEFAULT 'TRANSFER',
    "PlannedDate" DATE,
    "PostedAt" TIMESTAMPTZ(3),
    "PaidDate" DATE,
    "BankBatchNo" VARCHAR(50),
    "BankReference" VARCHAR(100),
    "FailureReason" VARCHAR(500),
    "JournalMemo" VARCHAR(1000),
    "JournalRemarks" VARCHAR(1000),

    CONSTRAINT "tr_payment_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_payment_line" (
    "Id" BIGSERIAL NOT NULL,
    "PaymentId" BIGINT NOT NULL,
    "LineNum" SMALLINT NOT NULL,
    "CoaId" INTEGER NOT NULL,
    "CostCenterId" INTEGER,
    "Description" VARCHAR(500),
    "Amount" DECIMAL(19,2) NOT NULL,

    CONSTRAINT "tr_payment_line_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_payment_allocation" (
    "PaymentId" BIGINT NOT NULL,
    "TargetDocumentId" BIGINT NOT NULL,
    "AmountApplied" DECIMAL(19,2) NOT NULL,
    "DiscountAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "AmountInPaymentCurrency" DECIMAL(19,2) NOT NULL,
    "FxDifferenceBase" DECIMAL(19,2) NOT NULL DEFAULT 0,

    CONSTRAINT "tr_payment_allocation_pkey" PRIMARY KEY ("PaymentId","TargetDocumentId")
);

-- CreateTable
CREATE TABLE "tr_cash_advance" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'CA',
    "EmployeeUserId" BIGINT NOT NULL,
    "TransactionTypeId" INTEGER NOT NULL,
    "Purpose" VARCHAR(1000) NOT NULL,
    "RequiredDate" DATE,
    "SettledAt" TIMESTAMPTZ(3),
    "ClosedAt" TIMESTAMPTZ(3),

    CONSTRAINT "tr_cash_advance_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_settlement" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'STL',
    "CashAdvanceId" BIGINT NOT NULL,
    "Purpose" VARCHAR(1000),
    "ReferenceNo" VARCHAR(100),
    "AdvanceAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "SpentAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "DifferenceAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "IsVoid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tr_settlement_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_reimbursement" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'RMB',
    "PayeeType" VARCHAR(10) NOT NULL,
    "EmployeeUserId" BIGINT,
    "TransactionTypeId" INTEGER NOT NULL,
    "ReferenceNo" VARCHAR(100),

    CONSTRAINT "tr_reimbursement_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_expense_line" (
    "Id" BIGSERIAL NOT NULL,
    "DocumentId" BIGINT NOT NULL,
    "LineNum" SMALLINT NOT NULL,
    "ExpenseAccountId" INTEGER,
    "CoaId" INTEGER NOT NULL,
    "CostCenterId" INTEGER,
    "Description" VARCHAR(500) NOT NULL,
    "ExpenseDate" DATE,
    "Amount" DECIMAL(19,2) NOT NULL,

    CONSTRAINT "tr_expense_line_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_ar_invoice" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'ARI',
    "InvoiceKind" VARCHAR(10) NOT NULL,
    "OriginalInvoiceId" BIGINT,
    "CustomerPoNo" VARCHAR(100),
    "CommercialInvoiceNo" VARCHAR(30),
    "CustomerTaxId" VARCHAR(20),
    "BillToAddress" VARCHAR(500),
    "ShippingMethod" VARCHAR(50),
    "InvoiceDate" DATE NOT NULL,
    "DueDate" DATE,
    "PaymentTermId" INTEGER,
    "ReceivingBankAccountId" INTEGER,
    "SubtotalAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "DiscountAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "FreightAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "DownPaymentAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "TaxBaseAmount" DECIMAL(19,2) NOT NULL,
    "TaxBaseOtherValue" DECIMAL(19,2),
    "VatTaxCodeId" INTEGER,
    "VatAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "WhtTaxCodeId" INTEGER,
    "WhtBaseAmount" DECIMAL(19,2),
    "WhtAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "TaxExchangeRate" DECIMAL(18,6),
    "VatAmountBase" DECIMAL(19,0),
    "WhtAmountBase" DECIMAL(19,0),
    "NetReceivable" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "TaxInvoiceNo" VARCHAR(30),
    "TaxInvoiceQr" TEXT,
    "IsVoid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tr_ar_invoice_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_ar_invoice_line" (
    "Id" BIGSERIAL NOT NULL,
    "InvoiceId" BIGINT NOT NULL,
    "LineNum" SMALLINT NOT NULL,
    "ItemId" BIGINT,
    "CustomerItemCode" VARCHAR(50),
    "Description" VARCHAR(500) NOT NULL,
    "Quantity" DECIMAL(18,4) NOT NULL,
    "UomId" INTEGER,
    "UnitPrice" DECIMAL(19,4) NOT NULL,
    "PackSize" DECIMAL(18,6),
    "InventoryQty" DECIMAL(18,4),
    "InventoryUnitPrice" DECIMAL(19,6),
    "IsWhtLiable" BOOLEAN NOT NULL DEFAULT false,
    "DiscountPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "LineAmount" DECIMAL(19,2) NOT NULL,
    "VatTaxCodeId" INTEGER,
    "VatAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "RevenueCoaId" INTEGER NOT NULL,
    "CostCenterId" INTEGER,
    "DeliveryRef" VARCHAR(50),

    CONSTRAINT "tr_ar_invoice_line_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_receipt" (
    "DocumentId" BIGINT NOT NULL,
    "DocType" VARCHAR(3) NOT NULL DEFAULT 'RCV',
    "PayerType" VARCHAR(10) NOT NULL,
    "EmployeeUserId" BIGINT,
    "ReceiptMethod" VARCHAR(20) NOT NULL DEFAULT 'TRANSFER',
    "CompanyBankAccountId" INTEGER,
    "ReceivedDate" DATE NOT NULL,
    "Amount" DECIMAL(19,2) NOT NULL,
    "BankReference" VARCHAR(100),

    CONSTRAINT "tr_receipt_pkey" PRIMARY KEY ("DocumentId")
);

-- CreateTable
CREATE TABLE "tr_receipt_allocation" (
    "ReceiptId" BIGINT NOT NULL,
    "TargetDocumentId" BIGINT NOT NULL,
    "AmountApplied" DECIMAL(19,2) NOT NULL,
    "AmountInReceiptCurrency" DECIMAL(19,2) NOT NULL,
    "FxDifferenceBase" DECIMAL(19,2) NOT NULL DEFAULT 0,

    CONSTRAINT "tr_receipt_allocation_pkey" PRIMARY KEY ("ReceiptId","TargetDocumentId")
);

-- CreateTable
CREATE TABLE "tr_journal_entry" (
    "Id" BIGSERIAL NOT NULL,
    "JournalNo" VARCHAR(30) NOT NULL,
    "PostingDate" DATE NOT NULL,
    "SourceDocumentId" BIGINT,
    "Memo" VARCHAR(500),
    "Status" VARCHAR(10) NOT NULL DEFAULT 'DRAFT',
    "ReversalOfId" BIGINT,
    "ExportedAt" TIMESTAMPTZ(3),
    "ExternalRef" VARCHAR(50),
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,

    CONSTRAINT "tr_journal_entry_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_journal_line" (
    "Id" BIGSERIAL NOT NULL,
    "JournalId" BIGINT NOT NULL,
    "LineNum" SMALLINT NOT NULL,
    "CoaId" INTEGER NOT NULL,
    "Debit" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "Credit" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "CurrencyCode" CHAR(3) NOT NULL DEFAULT 'IDR',
    "AmountFc" DECIMAL(19,2),
    "CostCenterId" INTEGER,
    "BpId" BIGINT,
    "EmployeeUserId" BIGINT,
    "Description" VARCHAR(500),

    CONSTRAINT "tr_journal_line_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_fx_revaluation" (
    "Id" BIGSERIAL NOT NULL,
    "RevaluationDate" DATE NOT NULL,
    "RateType" VARCHAR(10) NOT NULL DEFAULT 'MIDDLE',
    "Status" VARCHAR(10) NOT NULL DEFAULT 'DRAFT',
    "JournalId" BIGINT,
    "ReversalJournalId" BIGINT,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,

    CONSTRAINT "tr_fx_revaluation_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_fx_revaluation_line" (
    "Id" BIGSERIAL NOT NULL,
    "RevaluationId" BIGINT NOT NULL,
    "DocumentId" BIGINT NOT NULL,
    "CurrencyCode" CHAR(3) NOT NULL,
    "OpenAmount" DECIMAL(19,2) NOT NULL,
    "BookRate" DECIMAL(18,6) NOT NULL,
    "RevalRate" DECIMAL(18,6) NOT NULL,
    "DifferenceBase" DECIMAL(19,2) NOT NULL,

    CONSTRAINT "tr_fx_revaluation_line_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_document_approver_pick" (
    "DocumentId" BIGINT NOT NULL,
    "StepCode" VARCHAR(5) NOT NULL,
    "UserId" BIGINT NOT NULL,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,

    CONSTRAINT "tr_document_approver_pick_pkey" PRIMARY KEY ("DocumentId","StepCode")
);

-- CreateTable
CREATE TABLE "tr_approval_request" (
    "Id" BIGSERIAL NOT NULL,
    "DocumentId" BIGINT NOT NULL,
    "TemplateId" INTEGER NOT NULL,
    "RoundNo" SMALLINT NOT NULL,
    "Status" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "StartedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CompletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "tr_approval_request_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_approval_task" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ApprovalRequestId" BIGINT NOT NULL,
    "StepNo" SMALLINT NOT NULL,
    "AssigneeUserId" BIGINT NOT NULL,
    "Status" VARCHAR(10) NOT NULL DEFAULT 'WAITING',
    "ReceivedAt" TIMESTAMPTZ(3),
    "DueAt" TIMESTAMPTZ(3),
    "ActedByUserId" BIGINT,
    "ActingAs" VARCHAR(10),
    "ActedAt" TIMESTAMPTZ(3),
    "ActorJobTitle" VARCHAR(100),
    "Remarks" VARCHAR(1000),
    "ReplacesTaskId" BIGINT,
    "Version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tr_approval_task_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_notification" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "RecipientUserId" BIGINT NOT NULL,
    "DocumentId" BIGINT,
    "EventType" VARCHAR(40) NOT NULL,
    "Title" VARCHAR(200) NOT NULL,
    "Body" VARCHAR(1000),
    "ReadAt" TIMESTAMPTZ(3),
    "EmailStatus" VARCHAR(10) NOT NULL DEFAULT 'NONE',
    "EmailSentAt" TIMESTAMPTZ(3),
    "EmailError" VARCHAR(1000),
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tr_notification_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_user_handover" (
    "Id" BIGSERIAL NOT NULL,
    "FromUserId" BIGINT NOT NULL,
    "ToUserId" BIGINT NOT NULL,
    "Reason" VARCHAR(15) NOT NULL,
    "EffectiveDate" DATE NOT NULL,
    "Status" VARCHAR(10) NOT NULL DEFAULT 'OPEN',
    "CompletedAt" TIMESTAMPTZ(3),
    "DocumentsTransferred" INTEGER NOT NULL DEFAULT 0,
    "MappingsTransferred" INTEGER NOT NULL DEFAULT 0,
    "PicRolesTransferred" INTEGER NOT NULL DEFAULT 0,
    "OrgRolesTransferred" INTEGER NOT NULL DEFAULT 0,
    "Remarks" VARCHAR(1000),
    "ExecutedBy" BIGINT NOT NULL,
    "ExecutedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tr_user_handover_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "hist_handover_item" (
    "Id" BIGSERIAL NOT NULL,
    "HandoverId" BIGINT NOT NULL,
    "ItemType" VARCHAR(20) NOT NULL,
    "RecordKey" VARCHAR(100) NOT NULL,
    "OldUserId" BIGINT,
    "NewUserId" BIGINT,
    "Detail" VARCHAR(300),
    "LoggedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hist_handover_item_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_approval_reassignment" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "FromUserId" BIGINT NOT NULL,
    "ToUserId" BIGINT NOT NULL,
    "Reason" VARCHAR(15) NOT NULL,
    "Remarks" VARCHAR(1000) NOT NULL,
    "RequestedBy" BIGINT NOT NULL,
    "RequestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ApproverUserId" BIGINT NOT NULL,
    "Status" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "DecidedAt" TIMESTAMPTZ(3),
    "DecisionRemarks" VARCHAR(1000),
    "HandoverId" BIGINT,

    CONSTRAINT "tr_approval_reassignment_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "tr_approval_reassignment_item" (
    "Id" BIGSERIAL NOT NULL,
    "ReassignmentId" BIGINT NOT NULL,
    "OldTaskId" BIGINT NOT NULL,
    "NewTaskId" BIGINT,

    CONSTRAINT "tr_approval_reassignment_item_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "hist_document_status" (
    "Id" BIGSERIAL NOT NULL,
    "DocumentId" BIGINT NOT NULL,
    "FromStatus" VARCHAR(20),
    "ToStatus" VARCHAR(20) NOT NULL,
    "ActorUserId" BIGINT NOT NULL,
    "Remarks" VARCHAR(1000),
    "ActedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hist_document_status_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "hist_bp_status" (
    "Id" BIGSERIAL NOT NULL,
    "BpId" BIGINT NOT NULL,
    "StatusKind" VARCHAR(12) NOT NULL,
    "FromStatus" VARCHAR(20),
    "ToStatus" VARCHAR(20) NOT NULL,
    "Reason" VARCHAR(1000),
    "VerificationId" BIGINT,
    "ActorUserId" BIGINT NOT NULL,
    "ActedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hist_bp_status_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "hist_audit_log" (
    "Id" BIGSERIAL NOT NULL,
    "TableName" VARCHAR(64) NOT NULL,
    "RecordKey" VARCHAR(100) NOT NULL,
    "Action" VARCHAR(6) NOT NULL,
    "Changes" TEXT NOT NULL,
    "ActorUserId" BIGINT,
    "CorrelationId" VARCHAR(64),
    "OccurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hist_audit_log_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "hist_user_activity" (
    "Id" BIGSERIAL NOT NULL,
    "UserId" BIGINT,
    "SessionId" BIGINT,
    "Email" VARCHAR(254),
    "Action" VARCHAR(30) NOT NULL,
    "IpAddress" VARCHAR(45),
    "UserAgent" VARCHAR(500),
    "Detail" VARCHAR(500),
    "OccurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hist_user_activity_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "hist_rate_import" (
    "Id" BIGSERIAL NOT NULL,
    "Source" VARCHAR(20) NOT NULL,
    "RateType" VARCHAR(10) NOT NULL,
    "EffectiveDate" DATE NOT NULL,
    "StartedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "FinishedAt" TIMESTAMPTZ(3),
    "Status" VARCHAR(10) NOT NULL DEFAULT 'RUNNING',
    "RowsInserted" INTEGER NOT NULL DEFAULT 0,
    "RowsUpdated" INTEGER NOT NULL DEFAULT 0,
    "ErrorMessage" VARCHAR(2000),
    "TriggeredBy" BIGINT,

    CONSTRAINT "hist_rate_import_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "hist_access_log" (
    "Id" BIGSERIAL NOT NULL,
    "UserId" BIGINT NOT NULL,
    "Action" VARCHAR(20) NOT NULL,
    "ObjectType" VARCHAR(40) NOT NULL,
    "ObjectKey" VARCHAR(100),
    "Detail" VARCHAR(500),
    "IpAddress" VARCHAR(45),
    "OccurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hist_access_log_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "hist_bank_callback" (
    "Id" BIGSERIAL NOT NULL,
    "Provider" VARCHAR(20) NOT NULL DEFAULT 'MUFG',
    "EventType" VARCHAR(10) NOT NULL,
    "ExternalReference" VARCHAR(100),
    "PaymentId" BIGINT,
    "TargetDocumentId" BIGINT,
    "MatchedBy" VARCHAR(20),
    "Payload" TEXT NOT NULL,
    "ReceivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ProcessResult" VARCHAR(15) NOT NULL,
    "ErrorMessage" VARCHAR(1000),

    CONSTRAINT "hist_bank_callback_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "sys_file" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "StorageProvider" VARCHAR(20) NOT NULL DEFAULT 'AZURE_BLOB',
    "StorageKey" VARCHAR(500) NOT NULL,
    "OriginalName" VARCHAR(255) NOT NULL,
    "ContentType" VARCHAR(100) NOT NULL,
    "SizeBytes" BIGINT NOT NULL,
    "Sha256" BYTEA NOT NULL,
    "UploadedBy" BIGINT NOT NULL,
    "UploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ScanStatus" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "ScannedAt" TIMESTAMPTZ(3),

    CONSTRAINT "sys_file_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "sys_user_session" (
    "Id" BIGSERIAL NOT NULL,
    "PublicId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "UserId" BIGINT NOT NULL,
    "AuthMethod" VARCHAR(15) NOT NULL,
    "IpAddress" VARCHAR(45),
    "UserAgent" VARCHAR(500),
    "DeviceLabel" VARCHAR(100),
    "StartedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "LastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CsrfTokenHash" BYTEA,
    "CsrfIssuedAt" TIMESTAMPTZ(3),
    "ExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "EndedAt" TIMESTAMPTZ(3),
    "EndReason" VARCHAR(20),
    "EndedBy" BIGINT,

    CONSTRAINT "sys_user_session_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "sys_refresh_token" (
    "Id" BIGSERIAL NOT NULL,
    "SessionId" BIGINT NOT NULL,
    "TokenHash" BYTEA NOT NULL,
    "ExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "RotatedAt" TIMESTAMPTZ(3),
    "RevokedAt" TIMESTAMPTZ(3),
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_refresh_token_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "sys_rate_limit" (
    "Key" VARCHAR(200) NOT NULL,
    "HitCount" INTEGER NOT NULL DEFAULT 0,
    "WindowStartAt" TIMESTAMPTZ(3) NOT NULL,
    "ResetAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sys_rate_limit_pkey" PRIMARY KEY ("Key")
);

-- CreateTable
CREATE TABLE "sys_one_time_code" (
    "Id" BIGSERIAL NOT NULL,
    "Email" VARCHAR(254) NOT NULL,
    "Purpose" VARCHAR(20) NOT NULL,
    "CodeHash" BYTEA NOT NULL,
    "Attempts" SMALLINT NOT NULL DEFAULT 0,
    "ExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "ConsumedAt" TIMESTAMPTZ(3),
    "VerifiedAt" TIMESTAMPTZ(3),
    "InvalidatedAt" TIMESTAMPTZ(3),
    "RequestIp" VARCHAR(45),
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_one_time_code_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "sys_number_series" (
    "SeriesCode" VARCHAR(20) NOT NULL,
    "PeriodKey" CHAR(6) NOT NULL,
    "Prefix" VARCHAR(20) NOT NULL,
    "Format" VARCHAR(50) NOT NULL DEFAULT '{PREFIX}/{SEQ:3}/{MM}{YY}',
    "LastNumber" INTEGER NOT NULL DEFAULT 0,
    "AllowPortal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sys_number_series_pkey" PRIMARY KEY ("SeriesCode","PeriodKey")
);

-- CreateTable
CREATE TABLE "sys_ip_allow_list" (
    "Id" SERIAL NOT NULL,
    "IpOrCidr" VARCHAR(50) NOT NULL,
    "Description" VARCHAR(200),
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" BIGINT,

    CONSTRAINT "sys_ip_allow_list_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mst_user_PublicId_key" ON "mst_user"("PublicId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_user_Email_key" ON "mst_user"("Email");

-- CreateIndex
CREATE INDEX "mst_user_UserType_Status_idx" ON "mst_user"("UserType", "Status");

-- CreateIndex
CREATE UNIQUE INDEX "mst_user_Id_UserType_key" ON "mst_user"("Id", "UserType");

-- CreateIndex
CREATE UNIQUE INDEX "mst_role_Code_key" ON "mst_role"("Code");

-- CreateIndex
CREATE UNIQUE INDEX "mst_permission_Code_key" ON "mst_permission"("Code");

-- CreateIndex
CREATE INDEX "mst_role_permission_PermissionId_idx" ON "mst_role_permission"("PermissionId");

-- CreateIndex
CREATE INDEX "mst_user_role_RoleId_idx" ON "mst_user_role"("RoleId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_department_Code_key" ON "mst_department"("Code");

-- CreateIndex
CREATE INDEX "mst_department_ParentId_idx" ON "mst_department"("ParentId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_cost_center_Code_key" ON "mst_cost_center"("Code");

-- CreateIndex
CREATE INDEX "mst_cost_center_DepartmentId_idx" ON "mst_cost_center"("DepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_employee_EmployeeNo_key" ON "mst_employee"("EmployeeNo");

-- CreateIndex
CREATE INDEX "mst_employee_DepartmentId_idx" ON "mst_employee"("DepartmentId");

-- CreateIndex
CREATE INDEX "mst_employee_SuperiorUserId_idx" ON "mst_employee"("SuperiorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_employee_UserId_UserType_key" ON "mst_employee"("UserId", "UserType");

-- CreateIndex
CREATE UNIQUE INDEX "mst_currency_NumericCode_key" ON "mst_currency"("NumericCode");

-- CreateIndex
CREATE UNIQUE INDEX "mst_tax_code_Code_key" ON "mst_tax_code"("Code");

-- CreateIndex
CREATE INDEX "mst_tax_code_TaxType_IsActive_idx" ON "mst_tax_code"("TaxType", "IsActive");

-- CreateIndex
CREATE UNIQUE INDEX "mst_payment_term_Code_key" ON "mst_payment_term"("Code");

-- CreateIndex
CREATE UNIQUE INDEX "mst_uom_Code_key" ON "mst_uom"("Code");

-- CreateIndex
CREATE UNIQUE INDEX "mst_category_Code_key" ON "mst_category"("Code");

-- CreateIndex
CREATE INDEX "mst_category_ParentId_idx" ON "mst_category"("ParentId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_purchase_class_Code_key" ON "mst_purchase_class"("Code");

-- CreateIndex
CREATE UNIQUE INDEX "mst_item_Code_key" ON "mst_item"("Code");

-- CreateIndex
CREATE INDEX "mst_item_CategoryId_IsActive_idx" ON "mst_item"("CategoryId", "IsActive");

-- CreateIndex
CREATE INDEX "mst_item_Name_idx" ON "mst_item"("Name");

-- CreateIndex
CREATE INDEX "mst_form_note_DocType_UserId_idx" ON "mst_form_note"("DocType", "UserId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_expense_category_Code_key" ON "mst_expense_category"("Code");

-- CreateIndex
CREATE UNIQUE INDEX "mst_bank_Code_key" ON "mst_bank"("Code");

-- CreateIndex
CREATE UNIQUE INDEX "mst_bp_document_type_Code_key" ON "mst_bp_document_type"("Code");

-- CreateIndex
CREATE UNIQUE INDEX "mst_coa_AccountCode_key" ON "mst_coa"("AccountCode");

-- CreateIndex
CREATE INDEX "mst_coa_ParentId_idx" ON "mst_coa"("ParentId");

-- CreateIndex
CREATE INDEX "mst_coa_AccountType_IsActive_idx" ON "mst_coa"("AccountType", "IsActive");

-- CreateIndex
CREATE UNIQUE INDEX "mst_transaction_type_Module_Code_key" ON "mst_transaction_type"("Module", "Code");

-- CreateIndex
CREATE INDEX "mst_expense_account_Module_TransactionTypeId_DepartmentId_idx" ON "mst_expense_account"("Module", "TransactionTypeId", "DepartmentId");

-- CreateIndex
CREATE INDEX "mst_expense_account_CoaId_idx" ON "mst_expense_account"("CoaId");

-- CreateIndex
CREATE INDEX "mst_budget_FiscalYear_DepartmentId_idx" ON "mst_budget"("FiscalYear", "DepartmentId");

-- CreateIndex
CREATE INDEX "mst_account_determination_AccountRole_IsActive_idx" ON "mst_account_determination"("AccountRole", "IsActive");

-- CreateIndex
CREATE INDEX "mst_account_determination_CoaId_idx" ON "mst_account_determination"("CoaId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_company_bank_account_Code_key" ON "mst_company_bank_account"("Code");

-- CreateIndex
CREATE UNIQUE INDEX "mst_employee_bank_account_PublicId_key" ON "mst_employee_bank_account"("PublicId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_employee_bank_account_EmployeeUserId_BankId_AccountNo_key" ON "mst_employee_bank_account"("EmployeeUserId", "BankId", "AccountNo");

-- CreateIndex
CREATE INDEX "mst_approver_mapping_ApproverUserId_idx" ON "mst_approver_mapping"("ApproverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_approver_mapping_PreparerUserId_DocType_TransactionType_key" ON "mst_approver_mapping"("PreparerUserId", "DocType", "TransactionTypeId", "PaymentPurpose", "StepCode", "ApproverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_business_partner_PublicId_key" ON "mst_business_partner"("PublicId");

-- CreateIndex
CREATE INDEX "mst_business_partner_OnboardingStatus_OperationalStatus_idx" ON "mst_business_partner"("OnboardingStatus", "OperationalStatus");

-- CreateIndex
CREATE INDEX "mst_business_partner_LegalName_idx" ON "mst_business_partner"("LegalName");

-- CreateIndex
CREATE INDEX "mst_business_partner_IsSupplier_OperationalStatus_idx" ON "mst_business_partner"("IsSupplier", "OperationalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "mst_bp_address_PublicId_key" ON "mst_bp_address"("PublicId");

-- CreateIndex
CREATE INDEX "mst_bp_address_BpId_idx" ON "mst_bp_address"("BpId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_bp_contact_PublicId_key" ON "mst_bp_contact"("PublicId");

-- CreateIndex
CREATE INDEX "mst_bp_contact_BpId_idx" ON "mst_bp_contact"("BpId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_bp_bank_account_PublicId_key" ON "mst_bp_bank_account"("PublicId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_bp_bank_account_BpId_BankId_AccountNo_key" ON "mst_bp_bank_account"("BpId", "BankId", "AccountNo");

-- CreateIndex
CREATE INDEX "mst_bp_category_CategoryId_Status_idx" ON "mst_bp_category"("CategoryId", "Status");

-- CreateIndex
CREATE INDEX "mst_bp_user_UserId_IsActive_idx" ON "mst_bp_user"("UserId", "IsActive");

-- CreateIndex
CREATE INDEX "mst_bp_internal_pic_UserId_IsActive_idx" ON "mst_bp_internal_pic"("UserId", "IsActive");

-- CreateIndex
CREATE UNIQUE INDEX "mst_bp_document_PublicId_key" ON "mst_bp_document"("PublicId");

-- CreateIndex
CREATE INDEX "mst_bp_document_VerificationId_idx" ON "mst_bp_document"("VerificationId");

-- CreateIndex
CREATE UNIQUE INDEX "mst_bp_document_BpId_DocumentTypeId_VersionNo_key" ON "mst_bp_document"("BpId", "DocumentTypeId", "VersionNo");

-- CreateIndex
CREATE UNIQUE INDEX "mst_approval_template_Code_key" ON "mst_approval_template"("Code");

-- CreateIndex
CREATE INDEX "mst_approval_template_DocType_IsActive_Priority_idx" ON "mst_approval_template"("DocType", "IsActive", "Priority");

-- CreateIndex
CREATE UNIQUE INDEX "mst_approval_template_step_TemplateId_StepNo_key" ON "mst_approval_template_step"("TemplateId", "StepNo");

-- CreateIndex
CREATE INDEX "mst_approval_delegation_FromUserId_StartsAt_EndsAt_idx" ON "mst_approval_delegation"("FromUserId", "StartsAt", "EndsAt");

-- CreateIndex
CREATE INDEX "mst_approval_delegation_ToUserId_idx" ON "mst_approval_delegation"("ToUserId");

-- CreateIndex
CREATE INDEX "mst_approval_backup_BackupUserId_IsActive_idx" ON "mst_approval_backup"("BackupUserId", "IsActive");

-- CreateIndex
CREATE UNIQUE INDEX "mst_approval_backup_ApproverUserId_BackupUserId_key" ON "mst_approval_backup"("ApproverUserId", "BackupUserId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_document_PublicId_key" ON "tr_document"("PublicId");

-- CreateIndex
CREATE INDEX "tr_document_DocType_DocNo_idx" ON "tr_document"("DocType", "DocNo");

-- CreateIndex
CREATE INDEX "tr_document_DocType_Status_DocDate_idx" ON "tr_document"("DocType", "Status", "DocDate" DESC);

-- CreateIndex
CREATE INDEX "tr_document_BpId_DocType_Status_idx" ON "tr_document"("BpId", "DocType", "Status");

-- CreateIndex
CREATE INDEX "tr_document_OwnerUserId_DocType_Status_idx" ON "tr_document"("OwnerUserId", "DocType", "Status");

-- CreateIndex
CREATE INDEX "tr_document_DepartmentId_DocType_idx" ON "tr_document"("DepartmentId", "DocType");

-- CreateIndex
CREATE UNIQUE INDEX "tr_document_Id_DocType_key" ON "tr_document"("Id", "DocType");

-- CreateIndex
CREATE UNIQUE INDEX "tr_document_Id_DocType_BpId_key" ON "tr_document"("Id", "DocType", "BpId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_document_attachment_PublicId_key" ON "tr_document_attachment"("PublicId");

-- CreateIndex
CREATE INDEX "tr_document_attachment_DocumentId_RemovedAt_idx" ON "tr_document_attachment"("DocumentId", "RemovedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tr_document_comment_PublicId_key" ON "tr_document_comment"("PublicId");

-- CreateIndex
CREATE INDEX "tr_document_comment_DocumentId_CreatedAt_idx" ON "tr_document_comment"("DocumentId", "CreatedAt");

-- CreateIndex
CREATE INDEX "tr_document_comment_AuthorUserId_idx" ON "tr_document_comment"("AuthorUserId");

-- CreateIndex
CREATE INDEX "tr_bp_verification_ReviewerUserId_idx" ON "tr_bp_verification"("ReviewerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_bp_verification_DocumentId_DocType_key" ON "tr_bp_verification"("DocumentId", "DocType");

-- CreateIndex
CREATE INDEX "tr_bp_verification_check_VerificationId_idx" ON "tr_bp_verification_check"("VerificationId");

-- CreateIndex
CREATE INDEX "tr_bp_verification_check_BpDocumentId_idx" ON "tr_bp_verification_check"("BpDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_bp_profile_change_VerificationId_FieldName_key" ON "tr_bp_profile_change"("VerificationId", "FieldName");

-- CreateIndex
CREATE INDEX "tr_purchase_request_PurchaseClassId_idx" ON "tr_purchase_request"("PurchaseClassId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_purchase_request_DocumentId_DocType_key" ON "tr_purchase_request"("DocumentId", "DocType");

-- CreateIndex
CREATE INDEX "tr_purchase_request_line_LineStatus_CategoryId_idx" ON "tr_purchase_request_line"("LineStatus", "CategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_purchase_request_line_PurchaseRequestId_LineNum_key" ON "tr_purchase_request_line"("PurchaseRequestId", "LineNum");

-- CreateIndex
CREATE UNIQUE INDEX "tr_rfq_DocumentId_DocType_key" ON "tr_rfq"("DocumentId", "DocType");

-- CreateIndex
CREATE INDEX "tr_rfq_line_PurchaseRequestLineId_idx" ON "tr_rfq_line"("PurchaseRequestLineId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_rfq_line_RfqId_LineNum_key" ON "tr_rfq_line"("RfqId", "LineNum");

-- CreateIndex
CREATE INDEX "tr_rfq_participant_BpId_InvitationStatus_idx" ON "tr_rfq_participant"("BpId", "InvitationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "tr_rfq_participant_RfqId_BpId_key" ON "tr_rfq_participant"("RfqId", "BpId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_quotation_DocumentId_DocType_key" ON "tr_quotation"("DocumentId", "DocType");

-- CreateIndex
CREATE UNIQUE INDEX "tr_quotation_RfqParticipantId_RevisionNo_key" ON "tr_quotation"("RfqParticipantId", "RevisionNo");

-- CreateIndex
CREATE INDEX "tr_quotation_line_RfqLineId_idx" ON "tr_quotation_line"("RfqLineId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_quotation_line_QuotationId_RfqLineId_key" ON "tr_quotation_line"("QuotationId", "RfqLineId");

-- CreateIndex
CREATE INDEX "tr_purchase_order_QuotationId_idx" ON "tr_purchase_order"("QuotationId");

-- CreateIndex
CREATE INDEX "tr_purchase_order_ContractId_idx" ON "tr_purchase_order"("ContractId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_purchase_order_DocumentId_DocType_key" ON "tr_purchase_order"("DocumentId", "DocType");

-- CreateIndex
CREATE INDEX "tr_purchase_order_line_PurchaseRequestLineId_idx" ON "tr_purchase_order_line"("PurchaseRequestLineId");

-- CreateIndex
CREATE INDEX "tr_purchase_order_line_QuotationLineId_idx" ON "tr_purchase_order_line"("QuotationLineId");

-- CreateIndex
CREATE INDEX "tr_purchase_order_line_ContractLineId_idx" ON "tr_purchase_order_line"("ContractLineId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_purchase_order_line_PurchaseOrderId_LineNum_key" ON "tr_purchase_order_line"("PurchaseOrderId", "LineNum");

-- CreateIndex
CREATE INDEX "tr_purchase_contract_EndDate_idx" ON "tr_purchase_contract"("EndDate");

-- CreateIndex
CREATE UNIQUE INDEX "tr_purchase_contract_DocumentId_DocType_key" ON "tr_purchase_contract"("DocumentId", "DocType");

-- CreateIndex
CREATE UNIQUE INDEX "tr_purchase_contract_line_ContractId_LineNum_key" ON "tr_purchase_contract_line"("ContractId", "LineNum");

-- CreateIndex
CREATE UNIQUE INDEX "tr_landed_cost_PublicId_key" ON "tr_landed_cost"("PublicId");

-- CreateIndex
CREATE INDEX "tr_landed_cost_GoodsReceiptId_idx" ON "tr_landed_cost"("GoodsReceiptId");

-- CreateIndex
CREATE INDEX "tr_landed_cost_SourceInvoiceId_idx" ON "tr_landed_cost"("SourceInvoiceId");

-- CreateIndex
CREATE INDEX "tr_landed_cost_allocation_GoodsReceiptLineId_idx" ON "tr_landed_cost_allocation"("GoodsReceiptLineId");

-- CreateIndex
CREATE INDEX "tr_goods_receipt_PurchaseOrderId_idx" ON "tr_goods_receipt"("PurchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_goods_receipt_DocumentId_DocType_key" ON "tr_goods_receipt"("DocumentId", "DocType");

-- CreateIndex
CREATE INDEX "tr_goods_receipt_line_PurchaseOrderLineId_idx" ON "tr_goods_receipt_line"("PurchaseOrderLineId");

-- CreateIndex
CREATE INDEX "tr_goods_receipt_line_ReturnOfLineId_idx" ON "tr_goods_receipt_line"("ReturnOfLineId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_goods_receipt_line_GoodsReceiptId_LineNum_key" ON "tr_goods_receipt_line"("GoodsReceiptId", "LineNum");

-- CreateIndex
CREATE UNIQUE INDEX "tr_receipt_acceptance_GoodsReceiptId_AcceptanceType_key" ON "tr_receipt_acceptance"("GoodsReceiptId", "AcceptanceType");

-- CreateIndex
CREATE INDEX "tr_ap_invoice_PurchaseOrderId_idx" ON "tr_ap_invoice"("PurchaseOrderId");

-- CreateIndex
CREATE INDEX "tr_ap_invoice_DueDate_IsVoid_idx" ON "tr_ap_invoice"("DueDate", "IsVoid");

-- CreateIndex
CREATE INDEX "tr_ap_invoice_OriginalInvoiceId_idx" ON "tr_ap_invoice"("OriginalInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_ap_invoice_DocumentId_DocType_BpId_key" ON "tr_ap_invoice"("DocumentId", "DocType", "BpId");

-- CreateIndex
CREATE INDEX "tr_ap_invoice_line_PurchaseOrderLineId_idx" ON "tr_ap_invoice_line"("PurchaseOrderLineId");

-- CreateIndex
CREATE INDEX "tr_ap_invoice_line_GoodsReceiptLineId_idx" ON "tr_ap_invoice_line"("GoodsReceiptLineId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_ap_invoice_line_InvoiceId_LineNum_key" ON "tr_ap_invoice_line"("InvoiceId", "LineNum");

-- CreateIndex
CREATE INDEX "tr_ap_down_payment_application_DownPaymentInvoiceId_idx" ON "tr_ap_down_payment_application"("DownPaymentInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_ap_down_payment_application_InvoiceId_DownPaymentInvoice_key" ON "tr_ap_down_payment_application"("InvoiceId", "DownPaymentInvoiceId");

-- CreateIndex
CREATE INDEX "tr_payment_BpBankAccountId_idx" ON "tr_payment"("BpBankAccountId");

-- CreateIndex
CREATE INDEX "tr_payment_EmployeeBankAccountId_idx" ON "tr_payment"("EmployeeBankAccountId");

-- CreateIndex
CREATE INDEX "tr_payment_Purpose_PaidDate_idx" ON "tr_payment"("Purpose", "PaidDate");

-- CreateIndex
CREATE UNIQUE INDEX "tr_payment_DocumentId_DocType_key" ON "tr_payment"("DocumentId", "DocType");

-- CreateIndex
CREATE UNIQUE INDEX "tr_payment_line_PaymentId_LineNum_key" ON "tr_payment_line"("PaymentId", "LineNum");

-- CreateIndex
CREATE INDEX "tr_payment_allocation_TargetDocumentId_idx" ON "tr_payment_allocation"("TargetDocumentId");

-- CreateIndex
CREATE INDEX "tr_cash_advance_EmployeeUserId_idx" ON "tr_cash_advance"("EmployeeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_cash_advance_DocumentId_DocType_key" ON "tr_cash_advance"("DocumentId", "DocType");

-- CreateIndex
CREATE INDEX "tr_settlement_CashAdvanceId_idx" ON "tr_settlement"("CashAdvanceId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_settlement_DocumentId_DocType_key" ON "tr_settlement"("DocumentId", "DocType");

-- CreateIndex
CREATE INDEX "tr_reimbursement_EmployeeUserId_idx" ON "tr_reimbursement"("EmployeeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_reimbursement_DocumentId_DocType_key" ON "tr_reimbursement"("DocumentId", "DocType");

-- CreateIndex
CREATE INDEX "tr_expense_line_CoaId_idx" ON "tr_expense_line"("CoaId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_expense_line_DocumentId_LineNum_key" ON "tr_expense_line"("DocumentId", "LineNum");

-- CreateIndex
CREATE INDEX "tr_ar_invoice_DueDate_IsVoid_idx" ON "tr_ar_invoice"("DueDate", "IsVoid");

-- CreateIndex
CREATE INDEX "tr_ar_invoice_OriginalInvoiceId_idx" ON "tr_ar_invoice"("OriginalInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_ar_invoice_DocumentId_DocType_key" ON "tr_ar_invoice"("DocumentId", "DocType");

-- CreateIndex
CREATE UNIQUE INDEX "tr_ar_invoice_line_InvoiceId_LineNum_key" ON "tr_ar_invoice_line"("InvoiceId", "LineNum");

-- CreateIndex
CREATE UNIQUE INDEX "tr_receipt_DocumentId_DocType_key" ON "tr_receipt"("DocumentId", "DocType");

-- CreateIndex
CREATE INDEX "tr_receipt_allocation_TargetDocumentId_idx" ON "tr_receipt_allocation"("TargetDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_journal_entry_JournalNo_key" ON "tr_journal_entry"("JournalNo");

-- CreateIndex
CREATE INDEX "tr_journal_entry_SourceDocumentId_idx" ON "tr_journal_entry"("SourceDocumentId");

-- CreateIndex
CREATE INDEX "tr_journal_entry_PostingDate_idx" ON "tr_journal_entry"("PostingDate");

-- CreateIndex
CREATE INDEX "tr_journal_entry_ExportedAt_idx" ON "tr_journal_entry"("ExportedAt");

-- CreateIndex
CREATE INDEX "tr_journal_line_CoaId_idx" ON "tr_journal_line"("CoaId");

-- CreateIndex
CREATE INDEX "tr_journal_line_BpId_idx" ON "tr_journal_line"("BpId");

-- CreateIndex
CREATE INDEX "tr_journal_line_EmployeeUserId_idx" ON "tr_journal_line"("EmployeeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_journal_line_JournalId_LineNum_key" ON "tr_journal_line"("JournalId", "LineNum");

-- CreateIndex
CREATE INDEX "tr_fx_revaluation_RevaluationDate_idx" ON "tr_fx_revaluation"("RevaluationDate");

-- CreateIndex
CREATE INDEX "tr_fx_revaluation_line_DocumentId_idx" ON "tr_fx_revaluation_line"("DocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_fx_revaluation_line_RevaluationId_DocumentId_key" ON "tr_fx_revaluation_line"("RevaluationId", "DocumentId");

-- CreateIndex
CREATE INDEX "tr_document_approver_pick_UserId_idx" ON "tr_document_approver_pick"("UserId");

-- CreateIndex
CREATE INDEX "tr_approval_request_TemplateId_idx" ON "tr_approval_request"("TemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_approval_request_DocumentId_RoundNo_key" ON "tr_approval_request"("DocumentId", "RoundNo");

-- CreateIndex
CREATE UNIQUE INDEX "tr_approval_task_PublicId_key" ON "tr_approval_task"("PublicId");

-- CreateIndex
CREATE INDEX "tr_approval_task_ApprovalRequestId_StepNo_idx" ON "tr_approval_task"("ApprovalRequestId", "StepNo");

-- CreateIndex
CREATE INDEX "tr_approval_task_AssigneeUserId_Status_idx" ON "tr_approval_task"("AssigneeUserId", "Status");

-- CreateIndex
CREATE INDEX "tr_approval_task_ActedByUserId_ActedAt_idx" ON "tr_approval_task"("ActedByUserId", "ActedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tr_notification_PublicId_key" ON "tr_notification"("PublicId");

-- CreateIndex
CREATE INDEX "tr_notification_RecipientUserId_ReadAt_CreatedAt_idx" ON "tr_notification"("RecipientUserId", "ReadAt", "CreatedAt" DESC);

-- CreateIndex
CREATE INDEX "tr_user_handover_FromUserId_idx" ON "tr_user_handover"("FromUserId");

-- CreateIndex
CREATE INDEX "tr_user_handover_ToUserId_idx" ON "tr_user_handover"("ToUserId");

-- CreateIndex
CREATE INDEX "hist_handover_item_HandoverId_ItemType_idx" ON "hist_handover_item"("HandoverId", "ItemType");

-- CreateIndex
CREATE INDEX "hist_handover_item_ItemType_RecordKey_idx" ON "hist_handover_item"("ItemType", "RecordKey");

-- CreateIndex
CREATE UNIQUE INDEX "tr_approval_reassignment_PublicId_key" ON "tr_approval_reassignment"("PublicId");

-- CreateIndex
CREATE INDEX "tr_approval_reassignment_ApproverUserId_Status_idx" ON "tr_approval_reassignment"("ApproverUserId", "Status");

-- CreateIndex
CREATE INDEX "tr_approval_reassignment_FromUserId_Status_idx" ON "tr_approval_reassignment"("FromUserId", "Status");

-- CreateIndex
CREATE INDEX "tr_approval_reassignment_ToUserId_idx" ON "tr_approval_reassignment"("ToUserId");

-- CreateIndex
CREATE INDEX "tr_approval_reassignment_HandoverId_idx" ON "tr_approval_reassignment"("HandoverId");

-- CreateIndex
CREATE INDEX "tr_approval_reassignment_item_OldTaskId_idx" ON "tr_approval_reassignment_item"("OldTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "tr_approval_reassignment_item_ReassignmentId_OldTaskId_key" ON "tr_approval_reassignment_item"("ReassignmentId", "OldTaskId");

-- CreateIndex
CREATE INDEX "hist_document_status_DocumentId_ActedAt_idx" ON "hist_document_status"("DocumentId", "ActedAt");

-- CreateIndex
CREATE INDEX "hist_bp_status_BpId_ActedAt_idx" ON "hist_bp_status"("BpId", "ActedAt");

-- CreateIndex
CREATE INDEX "hist_audit_log_TableName_RecordKey_OccurredAt_idx" ON "hist_audit_log"("TableName", "RecordKey", "OccurredAt");

-- CreateIndex
CREATE INDEX "hist_audit_log_ActorUserId_OccurredAt_idx" ON "hist_audit_log"("ActorUserId", "OccurredAt");

-- CreateIndex
CREATE INDEX "hist_user_activity_UserId_OccurredAt_idx" ON "hist_user_activity"("UserId", "OccurredAt");

-- CreateIndex
CREATE INDEX "hist_user_activity_SessionId_idx" ON "hist_user_activity"("SessionId");

-- CreateIndex
CREATE INDEX "hist_user_activity_Action_OccurredAt_idx" ON "hist_user_activity"("Action", "OccurredAt");

-- CreateIndex
CREATE INDEX "hist_user_activity_OccurredAt_idx" ON "hist_user_activity"("OccurredAt");

-- CreateIndex
CREATE INDEX "hist_rate_import_RateType_EffectiveDate_idx" ON "hist_rate_import"("RateType", "EffectiveDate");

-- CreateIndex
CREATE INDEX "hist_rate_import_StartedAt_idx" ON "hist_rate_import"("StartedAt");

-- CreateIndex
CREATE INDEX "hist_access_log_UserId_OccurredAt_idx" ON "hist_access_log"("UserId", "OccurredAt");

-- CreateIndex
CREATE INDEX "hist_access_log_ObjectType_ObjectKey_idx" ON "hist_access_log"("ObjectType", "ObjectKey");

-- CreateIndex
CREATE INDEX "hist_access_log_OccurredAt_idx" ON "hist_access_log"("OccurredAt");

-- CreateIndex
CREATE INDEX "hist_bank_callback_PaymentId_idx" ON "hist_bank_callback"("PaymentId");

-- CreateIndex
CREATE INDEX "hist_bank_callback_ExternalReference_idx" ON "hist_bank_callback"("ExternalReference");

-- CreateIndex
CREATE INDEX "hist_bank_callback_ReceivedAt_idx" ON "hist_bank_callback"("ReceivedAt");

-- CreateIndex
CREATE INDEX "hist_bank_callback_TargetDocumentId_idx" ON "hist_bank_callback"("TargetDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "sys_file_PublicId_key" ON "sys_file"("PublicId");

-- CreateIndex
CREATE INDEX "sys_file_UploadedBy_idx" ON "sys_file"("UploadedBy");

-- CreateIndex
CREATE UNIQUE INDEX "sys_file_StorageProvider_StorageKey_key" ON "sys_file"("StorageProvider", "StorageKey");

-- CreateIndex
CREATE UNIQUE INDEX "sys_user_session_PublicId_key" ON "sys_user_session"("PublicId");

-- CreateIndex
CREATE INDEX "sys_user_session_UserId_StartedAt_idx" ON "sys_user_session"("UserId", "StartedAt" DESC);

-- CreateIndex
CREATE INDEX "sys_user_session_StartedAt_idx" ON "sys_user_session"("StartedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sys_refresh_token_TokenHash_key" ON "sys_refresh_token"("TokenHash");

-- CreateIndex
CREATE INDEX "sys_refresh_token_SessionId_idx" ON "sys_refresh_token"("SessionId");

-- CreateIndex
CREATE INDEX "sys_rate_limit_ResetAt_idx" ON "sys_rate_limit"("ResetAt");

-- CreateIndex
CREATE INDEX "sys_one_time_code_Email_Purpose_CreatedAt_idx" ON "sys_one_time_code"("Email", "Purpose", "CreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sys_ip_allow_list_IpOrCidr_key" ON "sys_ip_allow_list"("IpOrCidr");

-- AddForeignKey
ALTER TABLE "mst_user" ADD CONSTRAINT "mst_user_SignatureFileId_fkey" FOREIGN KEY ("SignatureFileId") REFERENCES "sys_file"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sys_user_credential" ADD CONSTRAINT "sys_user_credential_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_role_permission" ADD CONSTRAINT "mst_role_permission_RoleId_fkey" FOREIGN KEY ("RoleId") REFERENCES "mst_role"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_role_permission" ADD CONSTRAINT "mst_role_permission_PermissionId_fkey" FOREIGN KEY ("PermissionId") REFERENCES "mst_permission"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_user_role" ADD CONSTRAINT "mst_user_role_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_user_role" ADD CONSTRAINT "mst_user_role_RoleId_fkey" FOREIGN KEY ("RoleId") REFERENCES "mst_role"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_department" ADD CONSTRAINT "mst_department_ParentId_fkey" FOREIGN KEY ("ParentId") REFERENCES "mst_department"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_department" ADD CONSTRAINT "mst_department_HeadUserId_fkey" FOREIGN KEY ("HeadUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_cost_center" ADD CONSTRAINT "mst_cost_center_DepartmentId_fkey" FOREIGN KEY ("DepartmentId") REFERENCES "mst_department"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_employee" ADD CONSTRAINT "mst_employee_UserId_UserType_fkey" FOREIGN KEY ("UserId", "UserType") REFERENCES "mst_user"("Id", "UserType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_employee" ADD CONSTRAINT "mst_employee_DepartmentId_fkey" FOREIGN KEY ("DepartmentId") REFERENCES "mst_department"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_employee" ADD CONSTRAINT "mst_employee_SuperiorUserId_fkey" FOREIGN KEY ("SuperiorUserId") REFERENCES "mst_employee"("UserId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_exchange_rate" ADD CONSTRAINT "mst_exchange_rate_CurrencyCode_fkey" FOREIGN KEY ("CurrencyCode") REFERENCES "mst_currency"("Code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_category" ADD CONSTRAINT "mst_category_ParentId_fkey" FOREIGN KEY ("ParentId") REFERENCES "mst_category"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_item" ADD CONSTRAINT "mst_item_CategoryId_fkey" FOREIGN KEY ("CategoryId") REFERENCES "mst_category"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_item" ADD CONSTRAINT "mst_item_UomId_fkey" FOREIGN KEY ("UomId") REFERENCES "mst_uom"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_item" ADD CONSTRAINT "mst_item_VatTaxCodeId_fkey" FOREIGN KEY ("VatTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_item" ADD CONSTRAINT "mst_item_PurchaseUomId_fkey" FOREIGN KEY ("PurchaseUomId") REFERENCES "mst_uom"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_form_note" ADD CONSTRAINT "mst_form_note_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_coa" ADD CONSTRAINT "mst_coa_ParentId_fkey" FOREIGN KEY ("ParentId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_transaction_type" ADD CONSTRAINT "mst_transaction_type_ControlCoaId_fkey" FOREIGN KEY ("ControlCoaId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_expense_account" ADD CONSTRAINT "mst_expense_account_TransactionTypeId_fkey" FOREIGN KEY ("TransactionTypeId") REFERENCES "mst_transaction_type"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_expense_account" ADD CONSTRAINT "mst_expense_account_DepartmentId_fkey" FOREIGN KEY ("DepartmentId") REFERENCES "mst_department"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_expense_account" ADD CONSTRAINT "mst_expense_account_CoaId_fkey" FOREIGN KEY ("CoaId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_expense_account" ADD CONSTRAINT "mst_expense_account_ExpenseCategoryId_fkey" FOREIGN KEY ("ExpenseCategoryId") REFERENCES "mst_expense_category"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_budget" ADD CONSTRAINT "mst_budget_DepartmentId_fkey" FOREIGN KEY ("DepartmentId") REFERENCES "mst_department"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_budget" ADD CONSTRAINT "mst_budget_PurchaseClassId_fkey" FOREIGN KEY ("PurchaseClassId") REFERENCES "mst_purchase_class"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_account_determination" ADD CONSTRAINT "mst_account_determination_TaxCodeId_fkey" FOREIGN KEY ("TaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_account_determination" ADD CONSTRAINT "mst_account_determination_CategoryId_fkey" FOREIGN KEY ("CategoryId") REFERENCES "mst_category"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_account_determination" ADD CONSTRAINT "mst_account_determination_PurchaseClassId_fkey" FOREIGN KEY ("PurchaseClassId") REFERENCES "mst_purchase_class"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_account_determination" ADD CONSTRAINT "mst_account_determination_CurrencyCode_fkey" FOREIGN KEY ("CurrencyCode") REFERENCES "mst_currency"("Code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_account_determination" ADD CONSTRAINT "mst_account_determination_CoaId_fkey" FOREIGN KEY ("CoaId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_company_bank_account" ADD CONSTRAINT "mst_company_bank_account_BankId_fkey" FOREIGN KEY ("BankId") REFERENCES "mst_bank"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_company_bank_account" ADD CONSTRAINT "mst_company_bank_account_CurrencyCode_fkey" FOREIGN KEY ("CurrencyCode") REFERENCES "mst_currency"("Code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_company_bank_account" ADD CONSTRAINT "mst_company_bank_account_CoaId_fkey" FOREIGN KEY ("CoaId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_employee_bank_account" ADD CONSTRAINT "mst_employee_bank_account_EmployeeUserId_fkey" FOREIGN KEY ("EmployeeUserId") REFERENCES "mst_employee"("UserId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_employee_bank_account" ADD CONSTRAINT "mst_employee_bank_account_BankId_fkey" FOREIGN KEY ("BankId") REFERENCES "mst_bank"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_employee_bank_account" ADD CONSTRAINT "mst_employee_bank_account_CurrencyCode_fkey" FOREIGN KEY ("CurrencyCode") REFERENCES "mst_currency"("Code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approver_mapping" ADD CONSTRAINT "mst_approver_mapping_PreparerUserId_fkey" FOREIGN KEY ("PreparerUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approver_mapping" ADD CONSTRAINT "mst_approver_mapping_ApproverUserId_fkey" FOREIGN KEY ("ApproverUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approver_mapping" ADD CONSTRAINT "mst_approver_mapping_TransactionTypeId_fkey" FOREIGN KEY ("TransactionTypeId") REFERENCES "mst_transaction_type"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_business_partner" ADD CONSTRAINT "mst_business_partner_DefaultCurrencyCode_fkey" FOREIGN KEY ("DefaultCurrencyCode") REFERENCES "mst_currency"("Code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_business_partner" ADD CONSTRAINT "mst_business_partner_PaymentTermId_fkey" FOREIGN KEY ("PaymentTermId") REFERENCES "mst_payment_term"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_business_partner" ADD CONSTRAINT "mst_business_partner_ApControlCoaId_fkey" FOREIGN KEY ("ApControlCoaId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_business_partner" ADD CONSTRAINT "mst_business_partner_ArControlCoaId_fkey" FOREIGN KEY ("ArControlCoaId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_business_partner" ADD CONSTRAINT "mst_business_partner_DownPaymentCoaId_fkey" FOREIGN KEY ("DownPaymentCoaId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_business_partner" ADD CONSTRAINT "mst_business_partner_DefaultVatTaxCodeId_fkey" FOREIGN KEY ("DefaultVatTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_business_partner" ADD CONSTRAINT "mst_business_partner_DefaultWhtTaxCodeId_fkey" FOREIGN KEY ("DefaultWhtTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_address" ADD CONSTRAINT "mst_bp_address_BpId_fkey" FOREIGN KEY ("BpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_contact" ADD CONSTRAINT "mst_bp_contact_BpId_fkey" FOREIGN KEY ("BpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_bank_account" ADD CONSTRAINT "mst_bp_bank_account_BpId_fkey" FOREIGN KEY ("BpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_bank_account" ADD CONSTRAINT "mst_bp_bank_account_BankId_fkey" FOREIGN KEY ("BankId") REFERENCES "mst_bank"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_bank_account" ADD CONSTRAINT "mst_bp_bank_account_CurrencyCode_fkey" FOREIGN KEY ("CurrencyCode") REFERENCES "mst_currency"("Code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_bank_account" ADD CONSTRAINT "mst_bp_bank_account_ProofFileId_fkey" FOREIGN KEY ("ProofFileId") REFERENCES "sys_file"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_bank_account" ADD CONSTRAINT "mst_bp_bank_account_VerifiedBy_fkey" FOREIGN KEY ("VerifiedBy") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_category" ADD CONSTRAINT "mst_bp_category_BpId_fkey" FOREIGN KEY ("BpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_category" ADD CONSTRAINT "mst_bp_category_CategoryId_fkey" FOREIGN KEY ("CategoryId") REFERENCES "mst_category"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_category" ADD CONSTRAINT "mst_bp_category_DecidedBy_fkey" FOREIGN KEY ("DecidedBy") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_user" ADD CONSTRAINT "mst_bp_user_BpId_fkey" FOREIGN KEY ("BpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_user" ADD CONSTRAINT "mst_bp_user_UserId_UserType_fkey" FOREIGN KEY ("UserId", "UserType") REFERENCES "mst_user"("Id", "UserType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_internal_pic" ADD CONSTRAINT "mst_bp_internal_pic_BpId_fkey" FOREIGN KEY ("BpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_internal_pic" ADD CONSTRAINT "mst_bp_internal_pic_UserId_UserType_fkey" FOREIGN KEY ("UserId", "UserType") REFERENCES "mst_user"("Id", "UserType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_document" ADD CONSTRAINT "mst_bp_document_BpId_fkey" FOREIGN KEY ("BpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_document" ADD CONSTRAINT "mst_bp_document_DocumentTypeId_fkey" FOREIGN KEY ("DocumentTypeId") REFERENCES "mst_bp_document_type"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_document" ADD CONSTRAINT "mst_bp_document_FileId_fkey" FOREIGN KEY ("FileId") REFERENCES "sys_file"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_document" ADD CONSTRAINT "mst_bp_document_VerificationId_fkey" FOREIGN KEY ("VerificationId") REFERENCES "tr_bp_verification"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_bp_document" ADD CONSTRAINT "mst_bp_document_ReviewedBy_fkey" FOREIGN KEY ("ReviewedBy") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approval_template" ADD CONSTRAINT "mst_approval_template_DepartmentId_fkey" FOREIGN KEY ("DepartmentId") REFERENCES "mst_department"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approval_template" ADD CONSTRAINT "mst_approval_template_PurchaseClassId_fkey" FOREIGN KEY ("PurchaseClassId") REFERENCES "mst_purchase_class"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approval_template" ADD CONSTRAINT "mst_approval_template_TransactionTypeId_fkey" FOREIGN KEY ("TransactionTypeId") REFERENCES "mst_transaction_type"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approval_template_step" ADD CONSTRAINT "mst_approval_template_step_TemplateId_fkey" FOREIGN KEY ("TemplateId") REFERENCES "mst_approval_template"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approval_template_step" ADD CONSTRAINT "mst_approval_template_step_ApproverUserId_fkey" FOREIGN KEY ("ApproverUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approval_template_step" ADD CONSTRAINT "mst_approval_template_step_ApproverRoleId_fkey" FOREIGN KEY ("ApproverRoleId") REFERENCES "mst_role"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approval_delegation" ADD CONSTRAINT "mst_approval_delegation_FromUserId_fkey" FOREIGN KEY ("FromUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approval_delegation" ADD CONSTRAINT "mst_approval_delegation_ToUserId_fkey" FOREIGN KEY ("ToUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approval_delegation" ADD CONSTRAINT "mst_approval_delegation_DocumentId_fkey" FOREIGN KEY ("DocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approval_backup" ADD CONSTRAINT "mst_approval_backup_ApproverUserId_fkey" FOREIGN KEY ("ApproverUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_approval_backup" ADD CONSTRAINT "mst_approval_backup_BackupUserId_fkey" FOREIGN KEY ("BackupUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_document" ADD CONSTRAINT "tr_document_BpId_fkey" FOREIGN KEY ("BpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_document" ADD CONSTRAINT "tr_document_DepartmentId_fkey" FOREIGN KEY ("DepartmentId") REFERENCES "mst_department"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_document" ADD CONSTRAINT "tr_document_OwnerUserId_fkey" FOREIGN KEY ("OwnerUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_document" ADD CONSTRAINT "tr_document_CurrencyCode_fkey" FOREIGN KEY ("CurrencyCode") REFERENCES "mst_currency"("Code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_document_attachment" ADD CONSTRAINT "tr_document_attachment_DocumentId_fkey" FOREIGN KEY ("DocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_document_attachment" ADD CONSTRAINT "tr_document_attachment_SignedFileId_fkey" FOREIGN KEY ("SignedFileId") REFERENCES "sys_file"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_document_attachment" ADD CONSTRAINT "tr_document_attachment_FileId_fkey" FOREIGN KEY ("FileId") REFERENCES "sys_file"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_document_attachment" ADD CONSTRAINT "tr_document_attachment_StampedFileId_fkey" FOREIGN KEY ("StampedFileId") REFERENCES "sys_file"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_document_comment" ADD CONSTRAINT "tr_document_comment_DocumentId_fkey" FOREIGN KEY ("DocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_document_comment" ADD CONSTRAINT "tr_document_comment_AuthorUserId_fkey" FOREIGN KEY ("AuthorUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_bp_verification" ADD CONSTRAINT "tr_bp_verification_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_bp_verification" ADD CONSTRAINT "tr_bp_verification_ReviewerUserId_fkey" FOREIGN KEY ("ReviewerUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_bp_verification_check" ADD CONSTRAINT "tr_bp_verification_check_VerificationId_fkey" FOREIGN KEY ("VerificationId") REFERENCES "tr_bp_verification"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_bp_verification_check" ADD CONSTRAINT "tr_bp_verification_check_BpDocumentId_fkey" FOREIGN KEY ("BpDocumentId") REFERENCES "mst_bp_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_bp_verification_check" ADD CONSTRAINT "tr_bp_verification_check_CheckedBy_fkey" FOREIGN KEY ("CheckedBy") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_bp_profile_change" ADD CONSTRAINT "tr_bp_profile_change_VerificationId_fkey" FOREIGN KEY ("VerificationId") REFERENCES "tr_bp_verification"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_request" ADD CONSTRAINT "tr_purchase_request_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_request" ADD CONSTRAINT "tr_purchase_request_PurchaseClassId_fkey" FOREIGN KEY ("PurchaseClassId") REFERENCES "mst_purchase_class"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_request" ADD CONSTRAINT "tr_purchase_request_CostCenterId_fkey" FOREIGN KEY ("CostCenterId") REFERENCES "mst_cost_center"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_request_line" ADD CONSTRAINT "tr_purchase_request_line_PurchaseRequestId_fkey" FOREIGN KEY ("PurchaseRequestId") REFERENCES "tr_purchase_request"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_request_line" ADD CONSTRAINT "tr_purchase_request_line_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "mst_item"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_request_line" ADD CONSTRAINT "tr_purchase_request_line_CategoryId_fkey" FOREIGN KEY ("CategoryId") REFERENCES "mst_category"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_request_line" ADD CONSTRAINT "tr_purchase_request_line_UomId_fkey" FOREIGN KEY ("UomId") REFERENCES "mst_uom"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_request_line" ADD CONSTRAINT "tr_purchase_request_line_SuggestedBpId_fkey" FOREIGN KEY ("SuggestedBpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_request_line" ADD CONSTRAINT "tr_purchase_request_line_CostCenterId_fkey" FOREIGN KEY ("CostCenterId") REFERENCES "mst_cost_center"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_request_line" ADD CONSTRAINT "tr_purchase_request_line_InventoryUomId_fkey" FOREIGN KEY ("InventoryUomId") REFERENCES "mst_uom"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_rfq" ADD CONSTRAINT "tr_rfq_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_rfq_line" ADD CONSTRAINT "tr_rfq_line_RfqId_fkey" FOREIGN KEY ("RfqId") REFERENCES "tr_rfq"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_rfq_line" ADD CONSTRAINT "tr_rfq_line_PurchaseRequestLineId_fkey" FOREIGN KEY ("PurchaseRequestLineId") REFERENCES "tr_purchase_request_line"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_rfq_line" ADD CONSTRAINT "tr_rfq_line_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "mst_item"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_rfq_line" ADD CONSTRAINT "tr_rfq_line_CategoryId_fkey" FOREIGN KEY ("CategoryId") REFERENCES "mst_category"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_rfq_line" ADD CONSTRAINT "tr_rfq_line_UomId_fkey" FOREIGN KEY ("UomId") REFERENCES "mst_uom"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_rfq_participant" ADD CONSTRAINT "tr_rfq_participant_RfqId_fkey" FOREIGN KEY ("RfqId") REFERENCES "tr_rfq"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_rfq_participant" ADD CONSTRAINT "tr_rfq_participant_BpId_fkey" FOREIGN KEY ("BpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_rfq_participant" ADD CONSTRAINT "tr_rfq_participant_InvitedBy_fkey" FOREIGN KEY ("InvitedBy") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_quotation" ADD CONSTRAINT "tr_quotation_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_quotation" ADD CONSTRAINT "tr_quotation_RfqParticipantId_fkey" FOREIGN KEY ("RfqParticipantId") REFERENCES "tr_rfq_participant"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_quotation" ADD CONSTRAINT "tr_quotation_PaymentTermId_fkey" FOREIGN KEY ("PaymentTermId") REFERENCES "mst_payment_term"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_quotation" ADD CONSTRAINT "tr_quotation_EvaluatedBy_fkey" FOREIGN KEY ("EvaluatedBy") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_quotation_line" ADD CONSTRAINT "tr_quotation_line_QuotationId_fkey" FOREIGN KEY ("QuotationId") REFERENCES "tr_quotation"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_quotation_line" ADD CONSTRAINT "tr_quotation_line_RfqLineId_fkey" FOREIGN KEY ("RfqLineId") REFERENCES "tr_rfq_line"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_quotation_line" ADD CONSTRAINT "tr_quotation_line_VatTaxCodeId_fkey" FOREIGN KEY ("VatTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order" ADD CONSTRAINT "tr_purchase_order_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order" ADD CONSTRAINT "tr_purchase_order_QuotationId_fkey" FOREIGN KEY ("QuotationId") REFERENCES "tr_quotation"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order" ADD CONSTRAINT "tr_purchase_order_PurchaseClassId_fkey" FOREIGN KEY ("PurchaseClassId") REFERENCES "mst_purchase_class"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order" ADD CONSTRAINT "tr_purchase_order_PaymentTermId_fkey" FOREIGN KEY ("PaymentTermId") REFERENCES "mst_payment_term"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order" ADD CONSTRAINT "tr_purchase_order_BpContactId_fkey" FOREIGN KEY ("BpContactId") REFERENCES "mst_bp_contact"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order" ADD CONSTRAINT "tr_purchase_order_AcknowledgedBy_fkey" FOREIGN KEY ("AcknowledgedBy") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order" ADD CONSTRAINT "tr_purchase_order_ContractId_fkey" FOREIGN KEY ("ContractId") REFERENCES "tr_purchase_contract"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order_line" ADD CONSTRAINT "tr_purchase_order_line_PurchaseOrderId_fkey" FOREIGN KEY ("PurchaseOrderId") REFERENCES "tr_purchase_order"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order_line" ADD CONSTRAINT "tr_purchase_order_line_PurchaseRequestLineId_fkey" FOREIGN KEY ("PurchaseRequestLineId") REFERENCES "tr_purchase_request_line"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order_line" ADD CONSTRAINT "tr_purchase_order_line_QuotationLineId_fkey" FOREIGN KEY ("QuotationLineId") REFERENCES "tr_quotation_line"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order_line" ADD CONSTRAINT "tr_purchase_order_line_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "mst_item"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order_line" ADD CONSTRAINT "tr_purchase_order_line_UomId_fkey" FOREIGN KEY ("UomId") REFERENCES "mst_uom"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order_line" ADD CONSTRAINT "tr_purchase_order_line_VatTaxCodeId_fkey" FOREIGN KEY ("VatTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order_line" ADD CONSTRAINT "tr_purchase_order_line_CostCenterId_fkey" FOREIGN KEY ("CostCenterId") REFERENCES "mst_cost_center"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order_line" ADD CONSTRAINT "tr_purchase_order_line_InventoryUomId_fkey" FOREIGN KEY ("InventoryUomId") REFERENCES "mst_uom"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_order_line" ADD CONSTRAINT "tr_purchase_order_line_ContractLineId_fkey" FOREIGN KEY ("ContractLineId") REFERENCES "tr_purchase_contract_line"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_contract" ADD CONSTRAINT "tr_purchase_contract_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_contract" ADD CONSTRAINT "tr_purchase_contract_PurchaseClassId_fkey" FOREIGN KEY ("PurchaseClassId") REFERENCES "mst_purchase_class"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_contract" ADD CONSTRAINT "tr_purchase_contract_PaymentTermId_fkey" FOREIGN KEY ("PaymentTermId") REFERENCES "mst_payment_term"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_contract_line" ADD CONSTRAINT "tr_purchase_contract_line_ContractId_fkey" FOREIGN KEY ("ContractId") REFERENCES "tr_purchase_contract"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_contract_line" ADD CONSTRAINT "tr_purchase_contract_line_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "mst_item"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_contract_line" ADD CONSTRAINT "tr_purchase_contract_line_CategoryId_fkey" FOREIGN KEY ("CategoryId") REFERENCES "mst_category"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_contract_line" ADD CONSTRAINT "tr_purchase_contract_line_UomId_fkey" FOREIGN KEY ("UomId") REFERENCES "mst_uom"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_purchase_contract_line" ADD CONSTRAINT "tr_purchase_contract_line_VatTaxCodeId_fkey" FOREIGN KEY ("VatTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_landed_cost" ADD CONSTRAINT "tr_landed_cost_GoodsReceiptId_fkey" FOREIGN KEY ("GoodsReceiptId") REFERENCES "tr_goods_receipt"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_landed_cost" ADD CONSTRAINT "tr_landed_cost_SourceInvoiceId_fkey" FOREIGN KEY ("SourceInvoiceId") REFERENCES "tr_ap_invoice"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_landed_cost" ADD CONSTRAINT "tr_landed_cost_CurrencyCode_fkey" FOREIGN KEY ("CurrencyCode") REFERENCES "mst_currency"("Code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_landed_cost_allocation" ADD CONSTRAINT "tr_landed_cost_allocation_LandedCostId_fkey" FOREIGN KEY ("LandedCostId") REFERENCES "tr_landed_cost"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_landed_cost_allocation" ADD CONSTRAINT "tr_landed_cost_allocation_GoodsReceiptLineId_fkey" FOREIGN KEY ("GoodsReceiptLineId") REFERENCES "tr_goods_receipt_line"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_goods_receipt" ADD CONSTRAINT "tr_goods_receipt_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_goods_receipt" ADD CONSTRAINT "tr_goods_receipt_PurchaseOrderId_fkey" FOREIGN KEY ("PurchaseOrderId") REFERENCES "tr_purchase_order"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_goods_receipt" ADD CONSTRAINT "tr_goods_receipt_ReceivedBy_fkey" FOREIGN KEY ("ReceivedBy") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_goods_receipt_line" ADD CONSTRAINT "tr_goods_receipt_line_GoodsReceiptId_fkey" FOREIGN KEY ("GoodsReceiptId") REFERENCES "tr_goods_receipt"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_goods_receipt_line" ADD CONSTRAINT "tr_goods_receipt_line_PurchaseOrderLineId_fkey" FOREIGN KEY ("PurchaseOrderLineId") REFERENCES "tr_purchase_order_line"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_goods_receipt_line" ADD CONSTRAINT "tr_goods_receipt_line_ReturnOfLineId_fkey" FOREIGN KEY ("ReturnOfLineId") REFERENCES "tr_goods_receipt_line"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_receipt_acceptance" ADD CONSTRAINT "tr_receipt_acceptance_GoodsReceiptId_fkey" FOREIGN KEY ("GoodsReceiptId") REFERENCES "tr_goods_receipt"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice" ADD CONSTRAINT "tr_ap_invoice_DocumentId_DocType_BpId_fkey" FOREIGN KEY ("DocumentId", "DocType", "BpId") REFERENCES "tr_document"("Id", "DocType", "BpId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice" ADD CONSTRAINT "tr_ap_invoice_BpId_fkey" FOREIGN KEY ("BpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice" ADD CONSTRAINT "tr_ap_invoice_PurchaseOrderId_fkey" FOREIGN KEY ("PurchaseOrderId") REFERENCES "tr_purchase_order"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice" ADD CONSTRAINT "tr_ap_invoice_VatTaxCodeId_fkey" FOREIGN KEY ("VatTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice" ADD CONSTRAINT "tr_ap_invoice_WhtTaxCodeId_fkey" FOREIGN KEY ("WhtTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice" ADD CONSTRAINT "tr_ap_invoice_ReceiverUserId_fkey" FOREIGN KEY ("ReceiverUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice" ADD CONSTRAINT "tr_ap_invoice_OriginalInvoiceId_fkey" FOREIGN KEY ("OriginalInvoiceId") REFERENCES "tr_ap_invoice"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice_line" ADD CONSTRAINT "tr_ap_invoice_line_InvoiceId_fkey" FOREIGN KEY ("InvoiceId") REFERENCES "tr_ap_invoice"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice_line" ADD CONSTRAINT "tr_ap_invoice_line_PurchaseOrderLineId_fkey" FOREIGN KEY ("PurchaseOrderLineId") REFERENCES "tr_purchase_order_line"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice_line" ADD CONSTRAINT "tr_ap_invoice_line_GoodsReceiptLineId_fkey" FOREIGN KEY ("GoodsReceiptLineId") REFERENCES "tr_goods_receipt_line"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice_line" ADD CONSTRAINT "tr_ap_invoice_line_CoaId_fkey" FOREIGN KEY ("CoaId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice_line" ADD CONSTRAINT "tr_ap_invoice_line_CostCenterId_fkey" FOREIGN KEY ("CostCenterId") REFERENCES "mst_cost_center"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice_line" ADD CONSTRAINT "tr_ap_invoice_line_VatTaxCodeId_fkey" FOREIGN KEY ("VatTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_invoice_line" ADD CONSTRAINT "tr_ap_invoice_line_WhtTaxCodeId_fkey" FOREIGN KEY ("WhtTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_down_payment_application" ADD CONSTRAINT "tr_ap_down_payment_application_InvoiceId_fkey" FOREIGN KEY ("InvoiceId") REFERENCES "tr_ap_invoice"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ap_down_payment_application" ADD CONSTRAINT "tr_ap_down_payment_application_DownPaymentInvoiceId_fkey" FOREIGN KEY ("DownPaymentInvoiceId") REFERENCES "tr_ap_invoice"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_payment" ADD CONSTRAINT "tr_payment_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_payment" ADD CONSTRAINT "tr_payment_BpBankAccountId_fkey" FOREIGN KEY ("BpBankAccountId") REFERENCES "mst_bp_bank_account"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_payment" ADD CONSTRAINT "tr_payment_EmployeeBankAccountId_fkey" FOREIGN KEY ("EmployeeBankAccountId") REFERENCES "mst_employee_bank_account"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_payment" ADD CONSTRAINT "tr_payment_CompanyBankAccountId_fkey" FOREIGN KEY ("CompanyBankAccountId") REFERENCES "mst_company_bank_account"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_payment_line" ADD CONSTRAINT "tr_payment_line_PaymentId_fkey" FOREIGN KEY ("PaymentId") REFERENCES "tr_payment"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_payment_line" ADD CONSTRAINT "tr_payment_line_CoaId_fkey" FOREIGN KEY ("CoaId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_payment_line" ADD CONSTRAINT "tr_payment_line_CostCenterId_fkey" FOREIGN KEY ("CostCenterId") REFERENCES "mst_cost_center"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_payment_allocation" ADD CONSTRAINT "tr_payment_allocation_PaymentId_fkey" FOREIGN KEY ("PaymentId") REFERENCES "tr_payment"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_payment_allocation" ADD CONSTRAINT "tr_payment_allocation_TargetDocumentId_fkey" FOREIGN KEY ("TargetDocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_cash_advance" ADD CONSTRAINT "tr_cash_advance_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_cash_advance" ADD CONSTRAINT "tr_cash_advance_EmployeeUserId_fkey" FOREIGN KEY ("EmployeeUserId") REFERENCES "mst_employee"("UserId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_cash_advance" ADD CONSTRAINT "tr_cash_advance_TransactionTypeId_fkey" FOREIGN KEY ("TransactionTypeId") REFERENCES "mst_transaction_type"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_settlement" ADD CONSTRAINT "tr_settlement_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_settlement" ADD CONSTRAINT "tr_settlement_CashAdvanceId_fkey" FOREIGN KEY ("CashAdvanceId") REFERENCES "tr_cash_advance"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_reimbursement" ADD CONSTRAINT "tr_reimbursement_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_reimbursement" ADD CONSTRAINT "tr_reimbursement_EmployeeUserId_fkey" FOREIGN KEY ("EmployeeUserId") REFERENCES "mst_employee"("UserId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_reimbursement" ADD CONSTRAINT "tr_reimbursement_TransactionTypeId_fkey" FOREIGN KEY ("TransactionTypeId") REFERENCES "mst_transaction_type"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_expense_line" ADD CONSTRAINT "tr_expense_line_DocumentId_fkey" FOREIGN KEY ("DocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_expense_line" ADD CONSTRAINT "tr_expense_line_ExpenseAccountId_fkey" FOREIGN KEY ("ExpenseAccountId") REFERENCES "mst_expense_account"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_expense_line" ADD CONSTRAINT "tr_expense_line_CoaId_fkey" FOREIGN KEY ("CoaId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_expense_line" ADD CONSTRAINT "tr_expense_line_CostCenterId_fkey" FOREIGN KEY ("CostCenterId") REFERENCES "mst_cost_center"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ar_invoice" ADD CONSTRAINT "tr_ar_invoice_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ar_invoice" ADD CONSTRAINT "tr_ar_invoice_PaymentTermId_fkey" FOREIGN KEY ("PaymentTermId") REFERENCES "mst_payment_term"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ar_invoice" ADD CONSTRAINT "tr_ar_invoice_ReceivingBankAccountId_fkey" FOREIGN KEY ("ReceivingBankAccountId") REFERENCES "mst_company_bank_account"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ar_invoice" ADD CONSTRAINT "tr_ar_invoice_VatTaxCodeId_fkey" FOREIGN KEY ("VatTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ar_invoice" ADD CONSTRAINT "tr_ar_invoice_WhtTaxCodeId_fkey" FOREIGN KEY ("WhtTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ar_invoice" ADD CONSTRAINT "tr_ar_invoice_OriginalInvoiceId_fkey" FOREIGN KEY ("OriginalInvoiceId") REFERENCES "tr_ar_invoice"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ar_invoice_line" ADD CONSTRAINT "tr_ar_invoice_line_InvoiceId_fkey" FOREIGN KEY ("InvoiceId") REFERENCES "tr_ar_invoice"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ar_invoice_line" ADD CONSTRAINT "tr_ar_invoice_line_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "mst_item"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ar_invoice_line" ADD CONSTRAINT "tr_ar_invoice_line_UomId_fkey" FOREIGN KEY ("UomId") REFERENCES "mst_uom"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ar_invoice_line" ADD CONSTRAINT "tr_ar_invoice_line_VatTaxCodeId_fkey" FOREIGN KEY ("VatTaxCodeId") REFERENCES "mst_tax_code"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ar_invoice_line" ADD CONSTRAINT "tr_ar_invoice_line_RevenueCoaId_fkey" FOREIGN KEY ("RevenueCoaId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_ar_invoice_line" ADD CONSTRAINT "tr_ar_invoice_line_CostCenterId_fkey" FOREIGN KEY ("CostCenterId") REFERENCES "mst_cost_center"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_receipt" ADD CONSTRAINT "tr_receipt_DocumentId_DocType_fkey" FOREIGN KEY ("DocumentId", "DocType") REFERENCES "tr_document"("Id", "DocType") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_receipt" ADD CONSTRAINT "tr_receipt_EmployeeUserId_fkey" FOREIGN KEY ("EmployeeUserId") REFERENCES "mst_employee"("UserId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_receipt" ADD CONSTRAINT "tr_receipt_CompanyBankAccountId_fkey" FOREIGN KEY ("CompanyBankAccountId") REFERENCES "mst_company_bank_account"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_receipt_allocation" ADD CONSTRAINT "tr_receipt_allocation_ReceiptId_fkey" FOREIGN KEY ("ReceiptId") REFERENCES "tr_receipt"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_receipt_allocation" ADD CONSTRAINT "tr_receipt_allocation_TargetDocumentId_fkey" FOREIGN KEY ("TargetDocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_journal_entry" ADD CONSTRAINT "tr_journal_entry_SourceDocumentId_fkey" FOREIGN KEY ("SourceDocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_journal_entry" ADD CONSTRAINT "tr_journal_entry_ReversalOfId_fkey" FOREIGN KEY ("ReversalOfId") REFERENCES "tr_journal_entry"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_journal_line" ADD CONSTRAINT "tr_journal_line_JournalId_fkey" FOREIGN KEY ("JournalId") REFERENCES "tr_journal_entry"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_journal_line" ADD CONSTRAINT "tr_journal_line_CoaId_fkey" FOREIGN KEY ("CoaId") REFERENCES "mst_coa"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_journal_line" ADD CONSTRAINT "tr_journal_line_CurrencyCode_fkey" FOREIGN KEY ("CurrencyCode") REFERENCES "mst_currency"("Code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_journal_line" ADD CONSTRAINT "tr_journal_line_CostCenterId_fkey" FOREIGN KEY ("CostCenterId") REFERENCES "mst_cost_center"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_journal_line" ADD CONSTRAINT "tr_journal_line_BpId_fkey" FOREIGN KEY ("BpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_journal_line" ADD CONSTRAINT "tr_journal_line_EmployeeUserId_fkey" FOREIGN KEY ("EmployeeUserId") REFERENCES "mst_employee"("UserId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_fx_revaluation" ADD CONSTRAINT "tr_fx_revaluation_JournalId_fkey" FOREIGN KEY ("JournalId") REFERENCES "tr_journal_entry"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_fx_revaluation" ADD CONSTRAINT "tr_fx_revaluation_ReversalJournalId_fkey" FOREIGN KEY ("ReversalJournalId") REFERENCES "tr_journal_entry"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_fx_revaluation_line" ADD CONSTRAINT "tr_fx_revaluation_line_RevaluationId_fkey" FOREIGN KEY ("RevaluationId") REFERENCES "tr_fx_revaluation"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_fx_revaluation_line" ADD CONSTRAINT "tr_fx_revaluation_line_DocumentId_fkey" FOREIGN KEY ("DocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_fx_revaluation_line" ADD CONSTRAINT "tr_fx_revaluation_line_CurrencyCode_fkey" FOREIGN KEY ("CurrencyCode") REFERENCES "mst_currency"("Code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_document_approver_pick" ADD CONSTRAINT "tr_document_approver_pick_DocumentId_fkey" FOREIGN KEY ("DocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_document_approver_pick" ADD CONSTRAINT "tr_document_approver_pick_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_request" ADD CONSTRAINT "tr_approval_request_DocumentId_fkey" FOREIGN KEY ("DocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_request" ADD CONSTRAINT "tr_approval_request_TemplateId_fkey" FOREIGN KEY ("TemplateId") REFERENCES "mst_approval_template"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_task" ADD CONSTRAINT "tr_approval_task_ApprovalRequestId_fkey" FOREIGN KEY ("ApprovalRequestId") REFERENCES "tr_approval_request"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_task" ADD CONSTRAINT "tr_approval_task_AssigneeUserId_fkey" FOREIGN KEY ("AssigneeUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_task" ADD CONSTRAINT "tr_approval_task_ActedByUserId_fkey" FOREIGN KEY ("ActedByUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_task" ADD CONSTRAINT "tr_approval_task_ReplacesTaskId_fkey" FOREIGN KEY ("ReplacesTaskId") REFERENCES "tr_approval_task"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_notification" ADD CONSTRAINT "tr_notification_RecipientUserId_fkey" FOREIGN KEY ("RecipientUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_notification" ADD CONSTRAINT "tr_notification_DocumentId_fkey" FOREIGN KEY ("DocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_user_handover" ADD CONSTRAINT "tr_user_handover_FromUserId_fkey" FOREIGN KEY ("FromUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_user_handover" ADD CONSTRAINT "tr_user_handover_ToUserId_fkey" FOREIGN KEY ("ToUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hist_handover_item" ADD CONSTRAINT "hist_handover_item_HandoverId_fkey" FOREIGN KEY ("HandoverId") REFERENCES "tr_user_handover"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_reassignment" ADD CONSTRAINT "tr_approval_reassignment_FromUserId_fkey" FOREIGN KEY ("FromUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_reassignment" ADD CONSTRAINT "tr_approval_reassignment_ToUserId_fkey" FOREIGN KEY ("ToUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_reassignment" ADD CONSTRAINT "tr_approval_reassignment_RequestedBy_fkey" FOREIGN KEY ("RequestedBy") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_reassignment" ADD CONSTRAINT "tr_approval_reassignment_ApproverUserId_fkey" FOREIGN KEY ("ApproverUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_reassignment" ADD CONSTRAINT "tr_approval_reassignment_HandoverId_fkey" FOREIGN KEY ("HandoverId") REFERENCES "tr_user_handover"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_reassignment_item" ADD CONSTRAINT "tr_approval_reassignment_item_ReassignmentId_fkey" FOREIGN KEY ("ReassignmentId") REFERENCES "tr_approval_reassignment"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_reassignment_item" ADD CONSTRAINT "tr_approval_reassignment_item_OldTaskId_fkey" FOREIGN KEY ("OldTaskId") REFERENCES "tr_approval_task"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tr_approval_reassignment_item" ADD CONSTRAINT "tr_approval_reassignment_item_NewTaskId_fkey" FOREIGN KEY ("NewTaskId") REFERENCES "tr_approval_task"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hist_document_status" ADD CONSTRAINT "hist_document_status_DocumentId_fkey" FOREIGN KEY ("DocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hist_document_status" ADD CONSTRAINT "hist_document_status_ActorUserId_fkey" FOREIGN KEY ("ActorUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hist_bp_status" ADD CONSTRAINT "hist_bp_status_BpId_fkey" FOREIGN KEY ("BpId") REFERENCES "mst_business_partner"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hist_bp_status" ADD CONSTRAINT "hist_bp_status_VerificationId_fkey" FOREIGN KEY ("VerificationId") REFERENCES "tr_bp_verification"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hist_bp_status" ADD CONSTRAINT "hist_bp_status_ActorUserId_fkey" FOREIGN KEY ("ActorUserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hist_user_activity" ADD CONSTRAINT "hist_user_activity_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hist_user_activity" ADD CONSTRAINT "hist_user_activity_SessionId_fkey" FOREIGN KEY ("SessionId") REFERENCES "sys_user_session"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hist_bank_callback" ADD CONSTRAINT "hist_bank_callback_PaymentId_fkey" FOREIGN KEY ("PaymentId") REFERENCES "tr_payment"("DocumentId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hist_bank_callback" ADD CONSTRAINT "hist_bank_callback_TargetDocumentId_fkey" FOREIGN KEY ("TargetDocumentId") REFERENCES "tr_document"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sys_file" ADD CONSTRAINT "sys_file_UploadedBy_fkey" FOREIGN KEY ("UploadedBy") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sys_user_session" ADD CONSTRAINT "sys_user_session_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "mst_user"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sys_refresh_token" ADD CONSTRAINT "sys_refresh_token_SessionId_fkey" FOREIGN KEY ("SessionId") REFERENCES "sys_user_session"("Id") ON DELETE NO ACTION ON UPDATE NO ACTION;

