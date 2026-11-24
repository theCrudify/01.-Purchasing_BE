# 04.-Purchasing_BE

Backend **Purchasing Portal + Vendor Portal** — Hono + Postgres (Neon). Pasangan FE: `04.-Purchasing_FE`.
Desain database: `../02. KPIN_DB_REDESIGN`. Aturan kode wajib: **CONVENTIONS.md**.

## Scope
Login & akses (user, role, permission, karyawan, SSO Entra opsional) · master purchasing (departemen, mata uang & kurs, pajak, termin, UoM, kategori, purchase class, item, bank, budget, penomoran) · approval engine · Business Partner + registrasi & verifikasi vendor (portal) · PR → RFQ/Quotation → Kontrak → PO → GR/retur.
Di luar scope: AP invoice, payment, kasbon/settlement/reimburse, AR, jurnal (tabelnya tetap ada di schema).

## Struktur
```
db/prisma/schema.prisma      schema (port Postgres dari redesign)
db/migrations/               0001 generated · 0002/0010 fondasi · 01xx aturan DB · 02xx.. per modul (urut nama file)
db/reset-local.sh            bangun ulang DB lokal dari semua migrasi
src/core/                    db (transaksi + session context), list-query, crud, validate, storage, mailer, errors
src/middleware/              auth, permission, rate limit, origin guard (CSRF), error handler, request context
src/modules/<modul>/         <m>.routes.ts · <m>.controller.ts · <m>.service.ts · <m>.repository.ts · <m>.schema.ts
src/modules/_registry/       daftar route per grup
test/                        vitest (unit + integrasi ke Postgres asli)
```

## Jalankan lokal
```bash
npm install
cp .env.example .env                    # DATABASE_URL, JWT_SECRET, ALLOWED_ORIGINS (= origin FE)
./db/reset-local.sh purchasing                # Postgres lokal :54329
ADMIN_EMAIL=admin@purchasing.local ADMIN_PASSWORD='ganti-ini-12char' npm run seed:admin
npm run seed:demo                           # Buat akun demo internal & vendor (pw: Password123!)
npm run dev                             # http://localhost:3918
TEST_DATABASE_URL=postgresql://postgres@localhost:54329/purchasing npm test
```

## Deploy gratis
- **DB — Neon free**: terapkan migrasi berurutan `for f in db/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done`, lalu `npm run seed:admin`.
- **BE — Vercel Hobby (disarankan)**: project baru dari repo ini (framework Hono, entry `src/index.ts`). Env: `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS` (URL FE), `APP_URL` (URL FE), `CRON_SECRET`, `COOKIE_SECURE=true`, opsional `RESEND_API_KEY`, `MAIL_FROM`, `ENTRA_*`.
- **BE — Cloudflare Workers (alternatif)**: `npx wrangler secret put DATABASE_URL` / `JWT_SECRET`, `npm run deploy:cf`. ⚠️ Free plan = 10 ms CPU/request; hashing password saat login bisa melewati batas.
