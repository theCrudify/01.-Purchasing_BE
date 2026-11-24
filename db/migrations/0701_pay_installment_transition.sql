-- Allow pre-approved installment PAY documents to move directly from DRAFT to APPROVED. Idempotent.
INSERT INTO mst_status_transition ("DocType","FromStatus","ToStatus","RequiredApproval","AllowBp","Description")
VALUES ('PAY', 'DRAFT', 'APPROVED', NULL, false, 'pre-approved installment')
ON CONFLICT DO NOTHING;
