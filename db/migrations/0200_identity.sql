-- Identity & access group: permissions, search indexes, list views. Idempotent.

INSERT INTO mst_permission ("Code","Module","Name") VALUES
 ('USER.VIEW','USER','View users, roles and their sessions'),
 ('USER.MANAGE','USER','Create / edit users, assign roles, disable / enable / unlock'),
 ('ROLE.MANAGE','ROLE','Create / edit / delete roles and their permissions'),
 ('AUDIT.VIEW','AUDIT','View audit trail, login history and access log'),
 ('SECURITY.MANAGE','SECURITY','Manage IP allow list and force-logout sessions')
ON CONFLICT ("Code") DO NOTHING;

-- SSO: one KPIN user per Entra object id (bound on first SSO login)
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_credential_external_id ON sys_user_credential ("ExternalAuthId") WHERE "ExternalAuthId" IS NOT NULL;

-- IP allow list changes are audited like master data
DROP TRIGGER IF EXISTS trg_audit ON sys_ip_allow_list;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON sys_ip_allow_list FOR EACH ROW EXECUTE FUNCTION fn_audit();

-- trigram indexes for every searchable column
CREATE INDEX IF NOT EXISTS ix_user_email_trgm ON mst_user USING gin (lower("Email"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_user_displayname_trgm ON mst_user USING gin (lower("DisplayName"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_role_code_trgm ON mst_role USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_role_name_trgm ON mst_role USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_permission_code_trgm ON mst_permission USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_permission_name_trgm ON mst_permission USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_cost_center_code_trgm ON mst_cost_center USING gin (lower("Code"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_cost_center_name_trgm ON mst_cost_center USING gin (lower("Name"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_employee_no_trgm ON mst_employee USING gin (lower("EmployeeNo"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_employee_jobtitle_trgm ON mst_employee USING gin (lower("JobTitle"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_audit_log_table_trgm ON hist_audit_log USING gin (lower("TableName"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_audit_log_key_trgm ON hist_audit_log USING gin (lower("RecordKey"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_user_activity_email_trgm ON hist_user_activity USING gin (lower("Email"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_access_log_objtype_trgm ON hist_access_log USING gin (lower("ObjectType"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_ip_allow_list_ip_trgm ON sys_ip_allow_list USING gin (lower("IpOrCidr"::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_ip_allow_list_desc_trgm ON sys_ip_allow_list USING gin (lower("Description"::text) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- List views (joins for the list endpoints; searchable columns map onto indexed base columns)
CREATE OR REPLACE VIEW v_user_list AS
SELECT u."Id", u."PublicId", u."UserType", u."Email", u."DisplayName", u."Phone", u."Status", u."StatusReason",
       u."LastLoginAt", u."CreatedAt", u."UpdatedAt",
       e."EmployeeNo", d."Name" AS "DepartmentName",
       (SELECT string_agg(r."Code", ', ' ORDER BY r."Code") FROM mst_user_role ur JOIN mst_role r ON r."Id" = ur."RoleId" AND NOT r."IsDeleted"
         WHERE ur."UserId" = u."Id") AS "Roles"
  FROM mst_user u
  LEFT JOIN mst_employee e ON e."UserId" = u."Id"
  LEFT JOIN mst_department d ON d."Id" = e."DepartmentId";

CREATE OR REPLACE VIEW v_employee_list AS
SELECT e."UserId", u."PublicId", u."Email", u."DisplayName", e."EmployeeNo", e."DepartmentId", d."Code" AS "DepartmentCode", d."Name" AS "DepartmentName",
       e."JobTitle", e."SuperiorUserId", s."PublicId" AS "SuperiorPublicId", s."DisplayName" AS "SuperiorName",
       e."JoinDate", e."EndDate", e."EndReason", e."IsActive", e."UpdatedAt"
  FROM mst_employee e
  JOIN mst_user u ON u."Id" = e."UserId"
  JOIN mst_department d ON d."Id" = e."DepartmentId"
  LEFT JOIN mst_user s ON s."Id" = e."SuperiorUserId";

CREATE OR REPLACE VIEW v_audit_log AS
SELECT a."Id", a."TableName", a."RecordKey", a."Action", a."Changes", a."ActorUserId", u."PublicId" AS "ActorPublicId",
       u."Email" AS "ActorEmail", a."CorrelationId", a."OccurredAt"
  FROM hist_audit_log a LEFT JOIN mst_user u ON u."Id" = a."ActorUserId";

CREATE OR REPLACE VIEW v_user_session_list AS
SELECT s."Id", s."PublicId", s."UserId", u."PublicId" AS "UserPublicId", u."Email", u."DisplayName", s."AuthMethod", s."IpAddress", s."UserAgent",
       s."StartedAt", s."LastSeenAt", s."ExpiresAt", s."EndedAt", s."EndReason", s."EndedBy", eb."Email" AS "EndedByEmail",
       (s."EndedAt" IS NULL AND s."ExpiresAt" > now()) AS "IsActive"
  FROM sys_user_session s JOIN mst_user u ON u."Id" = s."UserId" LEFT JOIN mst_user eb ON eb."Id" = s."EndedBy";

CREATE OR REPLACE VIEW v_user_activity AS
SELECT a."Id", a."UserId", u."PublicId" AS "UserPublicId", COALESCE(a."Email", u."Email") AS "Email", a."Action", a."IpAddress", a."UserAgent", a."Detail", a."OccurredAt"
  FROM hist_user_activity a LEFT JOIN mst_user u ON u."Id" = a."UserId";

CREATE OR REPLACE VIEW v_access_log AS
SELECT a."Id", a."UserId", u."PublicId" AS "UserPublicId", u."Email", a."Action", a."ObjectType", a."ObjectKey", a."Detail", a."IpAddress", a."OccurredAt"
  FROM hist_access_log a JOIN mst_user u ON u."Id" = a."UserId";
