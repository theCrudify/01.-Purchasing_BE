# Purchasing Portal implementation conventions (read before writing any module)

Scope: **Purchasing + vendor portal** (identity, purchasing masters, approval, Business Partner + vendor registration/verification, PR → RFQ/Quotation → Contract → PO → GR/return, budget). Out of scope: AP invoice, payment, cash advance/settlement/reimbursement, AR, journal.
Parity references: `OLD/00. EXP_V1` (internal purchasing) and `OLD/00. Supplier Portal` (vendor side).
Stack, all free tier: **Neon Postgres** · **Hono API** (repo `04.-Purchasing_BE`, Vercel or Cloudflare Workers) · **Next.js 16** (repo `04.-Purchasing_FE`, Vercel; proxies `/api/*` to the BE) · Prisma only for schema/migrations.

Two separate git repos under `/home/jidan/Documents/00. IDS_DEV/02. KPIN/`: **BE** = `04.-Purchasing_BE/`, **FE** = `04.-Purchasing_FE/`. Paths below say `BE/…` or `FE/…`.

## Source of truth
- Business design: `../02. KPIN_DB_REDESIGN/01_architecture.md`, `02_data_dictionary.md`, `prisma/sql/*.sql` (SQL Server originals).
- Postgres schema: `BE/db/prisma/schema.prisma` → `BE/db/migrations/0001_init.generated.sql` (generated, never edit).
  Tables are snake_case (`@@map`), **columns are PascalCase and must be double-quoted in SQL** (`"Id"`, `"PublicId"`).
  int8 ids come back as JS numbers; `numeric` money comes back as **string** (never do float math on money in JS; let SQL compute or use string decimals).
- `PublicId` (uuid, DB default) is what goes in URLs for any table that has it. Never expose numeric `Id` of documents / BP / users in URLs.

## Local database
A throwaway Postgres 18 runs on `localhost:54329`, user `postgres`, no password (trust).
- `BE/db/reset-local.sh <your_db_name>` rebuilds a DB from all migrations in filename order.
  Use **your own DB name** (e.g. `purchasing_master`) so parallel work doesn't collide.
  `INCLUDE='^03'` limits to your migrations if someone else's WIP file is broken (0001/0002 always run).
- Tests: `cd BE && TEST_DATABASE_URL=postgresql://postgres@localhost:54329/<db> npx vitest run test/<yourfile>`.
- **Never** stop/restart the Postgres server, never drop databases you didn't create, never use `pkill`/`killall` (other apps run on this machine — kill only PIDs you started).

## Migrations (number ranges per group, to avoid clashes)
| Range | Owner |
|---|---|
| 0001–0099 | foundation (lead only; done: updated_at + audit triggers on all mst_/tr_, pg_trgm, base permissions, `sys_file_blob`) |
| 0100–0199 | db-port (constraints, triggers, guards, seeds, RLS) |
| 0200–0299 | identity · 0300–0399 master · 0400–0499 workflow · 0500–0599 bp (+ vendor portal) · 0600–0699 procurement |

Files must be **idempotent** (`CREATE … IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT DO NOTHING`) and plain SQL runnable by `psql`.
Each group adds: permission codes it uses (`INSERT INTO mst_permission … ON CONFLICT ("Code") DO NOTHING`) and a **pg_trgm GIN index for every searchable column**:
`CREATE INDEX IF NOT EXISTS ix_<table>_<col>_trgm ON <table> USING gin (lower("<Col>"::text) gin_trgm_ops);`

## API layering (mandatory for every module) — `BE/src/modules/<module>/`
| File | Does | Must not |
|---|---|---|
| `<m>.routes.ts` | Hono router: attach middleware (`requireAuth`, `requireUserType`, `requirePermission`, `validate(...)`) → controller | contain logic |
| `<m>.controller.ts` | HTTP in/out: read validated input, call service, return JSON (`{data}` or `{data, meta}`) | SQL, business rules |
| `<m>.service.ts` | business rules, ownership checks, transaction boundary via `db.session(actor, q => …)` | touch Hono `Context` |
| `<m>.repository.ts` | parameterised SQL only (`$1`…), never string-concatenate user input | permission checks, HTTP |
| `<m>.schema.ts` | zod schemas (+ `CrudDef` for masters) | – |

- Reference implementation: `modules/department` (master, built on `core/crud.ts`) and `modules/auth` (custom).
- Masters: extend `CrudRepository` / `CrudService`, use `crudController` + `crudRoutes`; add hooks/extra routes for custom rules.
- Validation: always `validate('json'|'query'|'param', schema)` from `core/validate.ts` (uniform 422). Use `.strict()` on bodies (no mass assignment).
- Errors: throw `HttpError` / `notFound` / `forbidden` / `conflict` from `core/errors.ts`. Postgres errors 23505→409, 23503/23514/P0001→422 are mapped by the error handler, so DB rules surface cleanly (`RAISE EXCEPTION` in triggers → 422 with the message).
- Every DB call goes through `db.session(actor, fn)`: one transaction, sets `purchasing.user_id` / `purchasing.user_type` (and extra keys like `purchasing.remarks` via the 3rd arg) with `set_config(..., true)`.
- Security: internal routes `requireUserType('INTERNAL')`; portal routes `requireUserType('BP')` **and** the service must scope every query to the BP(s) the user belongs to (`mst_bp_user`) — never trust a bpId from the client. Look up documents by `PublicId` and verify ownership (anti-IDOR). Rate-limit public endpoints (`rateLimit(...)`).
- Files: `core/storage.ts` (`saveFile(q, userId, file)` → validated, stored in Postgres `sys_file_blob`; `readFile`, `fileResponse`). Upload with multipart (`c.req.parseBody()`), authorise download by checking the owning record first.
- Email: `core/mailer.ts` (`sendMail(cfg, …)` via Resend HTTP free tier; logs when no key). Config via `c.get('cfg')` (`BE/src/env.ts`); add new env keys there.
- **Register routes only in your group file** `BE/src/modules/_registry/<group>.ts` (`['/path', router]`). Do not edit `src/index.ts`.

## Lists (mandatory for every list endpoint)
`GET /api/<x>?page=&pageSize=&q=&sort=field:asc,field2:desc[&filters]` → `{ data, meta: {page,pageSize,total,totalPages} }`.
Use `core/list-query.ts` (`listQuerySchema`, `runList`, `buildListSql`) or `CrudRepository.list`. pageSize ≤ 100, sort keys whitelisted, search tokens parameterised + LIKE-escaped, total via window count, trigram index per searchable column. For lists that need joins, wrap the join in a SQL **view** (in your migration) and point the `ListConfig.table` at the view.

## Frontend — `FE/src`
- Next.js 16 (App Router). Read `FE/node_modules/next/dist/docs/` before using unfamiliar APIs (`middleware` is now `proxy`).
- Internal pages under `app/(app)/…`, BP portal pages under `app/(portal)/portal/…`, public pages (login, register) outside both groups.
- Use the house kit: `components/ui.tsx` (Button, Input, Select, Field, Modal, Badge, Card, PageHeader, fmtMoney/fmtDate), `components/form.tsx` (`AutoForm`, `FieldDef`, `LookupSelect`), `components/data-table.tsx` + `lib/use-list.ts` (server-side list), `components/crud-page.tsx` (whole master page from config), `lib/api.ts` (`api/post/patch/del/qs`), `lib/me.tsx` (`useMe`, `useCan`).
- Pages are client components (`'use client'`) that call `/api/...`.
- **Register sidebar entries only in your group file** `FE/src/nav/<group>.ts`. Do not edit `nav/index.ts`, layouts, or `shell.tsx` (ask the lead in your final report if you need a change there).
- Accessibility: labels on inputs, buttons are `<button>`, `role="alert"` for errors.

## Done means
1. `cd BE && npx tsc --noEmit` clean, `cd FE && npx tsc --noEmit` clean and `npx next build` succeeds.
2. Your migrations apply on a fresh DB via `BE/db/reset-local.sh`.
3. Integration tests in `BE/test/<group>.*.test.ts` (use `test/helpers.ts`: `ensureUser`, `client`, `sql`) cover happy path + permission denial + at least one business-rule rejection per module, and pass.
4. No secrets in files. No new runtime dependency unless unavoidable (state why in the report).

## Running servers
BE dev server: `cd BE && npm run dev` (port 3918). FE dev server: `cd FE && npm run dev` (port 3917). The lead may have them running; do not kill them. Port 3123 belongs to another app on this machine — never touch it.
The old folder `03. KPIN_IMPLEMENTATION` is obsolete: do not read from or write to it.
