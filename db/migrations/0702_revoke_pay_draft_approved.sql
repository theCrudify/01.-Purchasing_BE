-- Installment payments now go through the PAY approval template like every other payment (maker-checker),
-- so the DRAFT -> APPROVED shortcut added by 0701 is withdrawn. Idempotent.
DELETE FROM mst_status_transition WHERE "DocType" = 'PAY' AND "FromStatus" = 'DRAFT' AND "ToStatus" = 'APPROVED';
