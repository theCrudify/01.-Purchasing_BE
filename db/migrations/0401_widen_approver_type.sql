-- ApproverType values PREPARER_MAPPING (16) and PREPARER_MAPPING_PICK (21) did not fit VARCHAR(15): saving such a step failed with a 500.
ALTER TABLE mst_approval_template_step ALTER COLUMN "ApproverType" TYPE VARCHAR(30);
