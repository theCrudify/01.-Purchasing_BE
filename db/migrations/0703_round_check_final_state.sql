-- The deferred round check runs at commit but read NEW, i.e. the row as it was when each event fired. A document created,
-- numbered and submitted in one transaction (e.g. installment payments) therefore failed on its own earlier DRAFT event.
-- Check the document's state at commit instead; the rule itself is unchanged. Idempotent.
CREATE OR REPLACE FUNCTION fn_document_round_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cur_status text; open_round boolean;
BEGIN
  SELECT "Status" INTO cur_status FROM tr_document WHERE "Id" = NEW."Id";
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT EXISTS (SELECT 1 FROM tr_approval_request WHERE "DocumentId" = NEW."Id" AND "Status" = 'PENDING') INTO open_round;
  IF (cur_status = 'PENDING_APPROVAL') <> open_round THEN
    RAISE EXCEPTION 'E51012: Document % status % does not match its approval round', NEW."Id", cur_status USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL;
END $$;
