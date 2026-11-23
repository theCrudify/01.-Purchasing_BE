-- Procurement group: PR, RFQ, Quotation (QUO), Purchase Contract (CTR), Purchase Order (PO), Goods Receipt (GR). Idempotent.

INSERT INTO mst_permission ("Code","Module","Name") VALUES
 ('PR.VIEW','PR','View purchase requests'),
 ('PR.CREATE','PR','Create and submit purchase requests'),
 ('RFQ.VIEW','RFQ','View requests for quotation'),
 ('RFQ.CREATE','RFQ','Create and manage requests for quotation'),
 ('QUO.VIEW','QUO','View vendor quotations'),
 ('QUO.CREATE','QUO','Create and evaluate vendor quotations'),
 ('CTR.VIEW','CTR','View purchase contracts'),
 ('CTR.CREATE','CTR','Create and submit purchase contracts'),
 ('PO.VIEW','PO','View purchase orders'),
 ('PO.CREATE','PO','Create and submit purchase orders'),
 ('GR.VIEW','GR','View goods receipts and returns'),
 ('GR.CREATE','GR','Create and submit goods receipts and returns')
ON CONFLICT ("Code") DO NOTHING;

-- Ensure ADMIN role has all permissions
INSERT INTO mst_role_permission ("RoleId","PermissionId")
SELECT r."Id", p."Id" FROM mst_role r CROSS JOIN mst_permission p WHERE r."Code"='ADMIN'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW vw_doc_pr AS
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

CREATE OR REPLACE VIEW vw_doc_rfq AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."DepartmentId", dep."Name" AS "DepartmentName",
       rfq."SubmissionDeadline", rfq."QuoteValidityDays", rfq."EvaluationMethod", rfq."Terms", rfq."PublishedAt",
       d."CurrencyCode", d."TotalAmount", d."TotalAmountBase",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       (SELECT count(*)::int FROM tr_rfq_line l WHERE l."RfqId" = d."Id") AS "LineCount",
       (SELECT count(*)::int FROM tr_rfq_participant p WHERE p."RfqId" = d."Id") AS "VendorCount",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_rfq rfq
JOIN tr_document d ON d."Id" = rfq."DocumentId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_department dep ON dep."Id" = d."DepartmentId";

CREATE OR REPLACE VIEW vw_doc_quo AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."BpId", bp."PublicId" AS "BpPublicId", bp."BpCode", bp."LegalName" AS "BpName",
       q."RfqParticipantId", p."RfqId", rd."PublicId" AS "RfqPublicId", rd."DocNo" AS "RfqDocNo",
       q."RevisionNo", q."IsLatest", q."BpReference", q."ValidUntil",
       q."PaymentTermId", pt."Name" AS "PaymentTermName", q."DeliveryTerms",
       q."EvaluationScore", q."EvaluationRank",
       d."CurrencyCode", d."TotalAmount", d."TotalAmountBase",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       (SELECT count(*)::int FROM tr_quotation_line l WHERE l."QuotationId" = d."Id") AS "LineCount",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_quotation q
JOIN tr_document d ON d."Id" = q."DocumentId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_business_partner bp ON bp."Id" = d."BpId"
LEFT JOIN tr_rfq_participant p ON p."Id" = q."RfqParticipantId"
LEFT JOIN tr_document rd ON rd."Id" = p."RfqId"
LEFT JOIN mst_payment_term pt ON pt."Id" = q."PaymentTermId";

CREATE OR REPLACE VIEW vw_doc_ctr AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."BpId", bp."PublicId" AS "BpPublicId", bp."BpCode", bp."LegalName" AS "BpName",
       c."AgreementType", c."StartDate", c."EndDate", c."TargetAmount",
       c."PurchaseClassId", pc."Name" AS "PurchaseClassName",
       c."PaymentTermId", pt."Name" AS "PaymentTermName", c."BpReference",
       d."CurrencyCode", d."TotalAmount", d."TotalAmountBase",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       (SELECT count(*)::int FROM tr_purchase_contract_line l WHERE l."ContractId" = d."Id") AS "LineCount",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_purchase_contract c
JOIN tr_document d ON d."Id" = c."DocumentId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_business_partner bp ON bp."Id" = d."BpId"
LEFT JOIN mst_purchase_class pc ON pc."Id" = c."PurchaseClassId"
LEFT JOIN mst_payment_term pt ON pt."Id" = c."PaymentTermId";

CREATE OR REPLACE VIEW vw_doc_po AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."BpId", bp."PublicId" AS "BpPublicId", bp."BpCode", bp."LegalName" AS "BpName",
       po."PurchaseClassId", pc."Name" AS "PurchaseClassName",
       po."PaymentTermId", pt."Name" AS "PaymentTermName",
       po."PoType", po."BpReference", po."ShippingMethod", po."DeliveryDate", po."EtaDate", po."DeliveryAddress",
       po."SubtotalAmount", po."DiscountAmount", po."FreightAmount", po."VatAmount", po."GrandTotal",
       po."IssuedAt", po."AcknowledgedAt",
       d."CurrencyCode", d."TotalAmount", d."TotalAmountBase",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       (SELECT count(*)::int FROM tr_purchase_order_line l WHERE l."PurchaseOrderId" = d."Id") AS "LineCount",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_purchase_order po
JOIN tr_document d ON d."Id" = po."DocumentId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN mst_business_partner bp ON bp."Id" = d."BpId"
LEFT JOIN mst_purchase_class pc ON pc."Id" = po."PurchaseClassId"
LEFT JOIN mst_payment_term pt ON pt."Id" = po."PaymentTermId";

CREATE OR REPLACE VIEW vw_doc_gr AS
SELECT d."Id", d."PublicId", d."DocType", d."DocNo", d."DocDate", d."Status", d."Title",
       d."BpId", bp."PublicId" AS "BpPublicId", bp."BpCode", bp."LegalName" AS "BpName",
       gr."ReceiptKind", gr."ReturnReason", gr."PurchaseOrderId",
       pod."PublicId" AS "PoPublicId", pod."DocNo" AS "PoDocNo",
       gr."ReceivedDate", gr."DeliveryNoteNo", gr."VehiclePlateNo", gr."DriverName", gr."CarrierName", gr."Location",
       d."CurrencyCode", d."TotalAmount", d."TotalAmountBase",
       d."OwnerUserId", ou."DisplayName" AS "OwnerName",
       (SELECT count(*)::int FROM tr_goods_receipt_line l WHERE l."GoodsReceiptId" = d."Id") AS "LineCount",
       d."Remarks", d."IsDeleted", d."CreatedAt", d."UpdatedAt"
FROM tr_goods_receipt gr
JOIN tr_document d ON d."Id" = gr."DocumentId"
JOIN mst_user ou ON ou."Id" = d."OwnerUserId"
LEFT JOIN tr_document pod ON pod."Id" = gr."PurchaseOrderId"
LEFT JOIN mst_business_partner bp ON bp."Id" = d."BpId";
