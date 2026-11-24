-- Standard payment terms (reference data; safe to re-run).
INSERT INTO mst_payment_term ("Code", "Name", "DueDays", "BaselineDate") VALUES
  ('CBD',   'Cash Before Delivery',            0, 'INVOICE_DATE'),
  ('COD',   'Cash On Delivery',                0, 'RECEIPT_DATE'),
  ('NET7',  'Net 7 days after invoice',        7, 'INVOICE_DATE'),
  ('NET14', 'Net 14 days after invoice',      14, 'INVOICE_DATE'),
  ('NET30', 'Net 30 days after invoice',      30, 'INVOICE_DATE'),
  ('NET45', 'Net 45 days after invoice',      45, 'INVOICE_DATE'),
  ('NET60', 'Net 60 days after invoice',      60, 'INVOICE_DATE'),
  ('NET90', 'Net 90 days after invoice',      90, 'INVOICE_DATE')
ON CONFLICT ("Code") DO NOTHING;
