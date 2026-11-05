# Ruwa Local Board · Approvals, Licensing & Service Desk

> **Local authority edition (`local-authority` branch).** Branded for **Ruwa Local Board** (crest green `#1E7B34`, deep-green shell, gold accent) and extended with a **licensing module**: a licence schedule with fees, validity and document checklists; applications → review → inspection → approval → fee receipt → issue, with printable certificates, renewals, suspension/revocation, a 30-day expiry sweep, and citizen self-service: a public *Apply for a licence* portal with document upload and tracking (`/apply`, `/verify`) and a WhatsApp flow (*Apply for a licence*, *My licence applications*, *I have paid*), with applicant notices at every step. Each licence type has its own customisable application form and office-use section (the Shop Licence Act, Registration of Premises and General Application paper forms are seeded), and fees go through a payment ledger with Finance confirmation before a licence is issued. Every status and priority in the system is colour-coded through one registry (`src/components/StatusTag.tsx`). Demo accounts: `docs/TEST-ACCOUNTS.md`; module guide: `docs/LOCAL-AUTHORITY.md`.

Internal approval system for the **Zimbabwe National Statistics Agency**: travelling & subsistence advances and expense claims, leave applications and internal memos, routed through the same signatures as the paper forms (Head of Section → Finance → Director General, Supervisor → Head of Office → Registry, and so on).

Next.js 16 (App Router) + Ant Design + Prisma on **MariaDB/MySQL**. The API lives in `src/app/api/*` and the UI in `src/app/*`. This `master` branch is the single-organisation edition; the multi-tenant SaaS edition with subscriptions and billing lives on the `billing` branch.

- [docs/ZIMSTAT-WORKFLOWS.md](docs/ZIMSTAT-WORKFLOWS.md): how each paper form maps to a workflow.
- [docs/TEST-ACCOUNTS.md](docs/TEST-ACCOUNTS.md): demo officers and walk-throughs.
- [SECURITY.md](SECURITY.md): OWASP ASVS control map and operator duties.

## Quick start (development)

1. Create the database once (MariaDB 10.4+ or MySQL 8 with `sql_mode` allowing TEXT defaults; XAMPP's MariaDB works as is):

   ```sql
   CREATE DATABASE documentdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Install, create the tables and seed the Agency:

   ```bash
   npm install
   npm run setup      # prisma db push + seed
   npm run dev        # http://localhost:3000
   ```

Sign in as `ict.admin@zimstat.co.zw` / `Password123!` (full list in docs/TEST-ACCOUNTS.md).

## Deploying with Docker (recommended)

`docker-compose.yml` runs two containers: the app (UI + API, published on host port **3443**, bound to localhost) and MariaDB 11. nginx on the host serves the domain over HTTPS and proxies to port 3443.

```bash
git clone https://github.com/stabnashiamunashe/synapsas.git zimstat-approvals && cd zimstat-approvals
cp .env.docker.example .env && nano .env   # DB passwords, AUTH_SECRET, APP_URL, SMTP settings
docker compose up -d --build
docker compose --profile seed run --rm seed              # Agency, sections, demo officers and the four workflows
```

nginx + certificate (replace the hostname in `deploy/nginx/approvals.zimstat.co.zw.conf` with yours):

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx/approvals.zimstat.co.zw.conf /etc/nginx/sites-available/approvals
sudo ln -s /etc/nginx/sites-available/approvals /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d approvals.zimstat.co.zw
```

Every later release: `bash scripts/deploy-docker.sh` (pulls, rebuilds, restarts). Schedule the maintenance jobs on the host:

```
*/5 * * * *  curl -s -H "Authorization: Bearer $CRON_SECRET" https://approvals.zimstat.co.zw/api/cron/email    # email retries + digests
0   * * * *  curl -s -H "Authorization: Bearer $CRON_SECRET" https://approvals.zimstat.co.zw/api/cron/escalate # SLA escalation
```

The app refuses to start in production with a default `AUTH_SECRET`, a non-HTTPS `APP_URL` or a weak `CRON_SECRET` (`src/instrumentation.ts`).

### Upgrading an existing database with the resource modules

```bash
npx prisma db push && npm run db:seed:modules
```

`prisma/seed-modules.ts` is additive: it links the T&S workflows to the advances ledger, adds the Vehicle request workflow, public holidays and sample notices, assets, vehicles and trips, and skips anything already present. In Docker: `docker compose --profile seed run --rm seed npx tsx prisma/seed-modules.ts`.

## What is included

- **Workflows modelled on the Agency's forms**: T&S Advance Application (TSA), T&S Expense Claim (TSC), Application for Leave (LV), Application for Annual Leave / off days (AL), Internal memo. Each is fully editable: fields, line-item tables with computed columns, approval levels, conditions, loop-backs.
- **Approvers**: Head of Section, supervisor / line manager, **any officer in a named section** (Finance certification, Registry filing, Internal Audit), named people (Director General, Accountant), or a person/section chosen on the form. ANY/ALL modes, SLAs with escalation, out-of-office delegation, return-for-changes to the requester or to an earlier level.
- **Service desk** (ported from the local-council issue tracker): cases with a nine-state lifecycle, categories with SLAs, least-busy auto-assignment, duplicate detection, Kanban board and table with saved views, internal notes and public updates, attachments, and a public portal at `/report` and `/track` with ratings. See docs/ZIMSTAT-WORKFLOWS.md section 5.
- **WhatsApp intake** (optional): button-driven reporting and tracking on the Meta WhatsApp Business Cloud API, template updates to reporters, in-app sandbox; the system runs unchanged when it is not configured. See docs/WHATSAPP.md.
- **Leave balance**: 12-day annual entitlement (Settings → Organisation), taken/pending/remaining shown on every leave request.
- **Advances ledger**: every approved T&S advance opens an account entry that the approved claim clears automatically; Finance records refunds, salary recoveries and write-offs; overdue reminders; balance strip on the forms.
- **Leave calendar & register**: who is away per month with public holidays; per-officer register for the year with CSV export.
- **Notice board**: circulars, policies, announcements and memos with audiences by section and role, pinning, expiry and tracked acknowledgements.
- **Asset register**: equipment with issue/return/repair/loss history, holders, warranties, CSV export and links from service desk cases.
- **Fleet & trips**: Vehicle request workflow creates trip bookings on approval; the transport office assigns vehicles and drivers with overlap checks and records odometer and fuel.
- **Projects & surveys** (ZDHS, MICS, Census…): every advance and claim is charged to a project so costs roll up per survey and funder.
- **Email**: SMTP outbox with retries, invitations, temporary passwords, password reset, security alerts, approval notifications and digests.
- **Security**: OWASP ASVS L2 controls (see SECURITY.md): strict CSP, 2FA with encrypted secrets, breached-password check, lockout, audit log, hardened uploads, rate limits.
- **Reports**, dashboard, CSV exports, audit log, API keys and signed webhooks for integration with finance systems.

## Brand

ZimStat blue `#1414D2` with the Agency logo (`public/brand/zimstat-logo.png`); accents red `#D7262D` and gold `#F0D040` from the emblem. Change the name, logo, colour and footer under Settings → Branding.

The interface follows the IBM Carbon Design System conventions: IBM Plex Sans and Plex Mono (self-hosted from `@fontsource`, no external requests), a gray-10 canvas with gray-20 borders, square corners, 40 px controls with Carbon-style fields and a single 1 px focus ring in the tenant's primary colour, flat data tiles with an accent bar, and Carbon tag colours. Navigation is a single registry (`src/lib/nav.ts`) that drives the dark Carbon-style sidebar and the Ctrl K command palette (`src/components/CommandPalette.tsx`), so every page is both listed and searchable, alongside live request and case matches. Workflow and category icons are chosen from a named icon set (`src/components/AppIcon.tsx`, Ant Design outlined glyphs); no emoji appear in the product. Legacy emoji values in existing data are mapped to the nearest named icon automatically and converted by `npm run db:seed:modules`.

## Key files

- `prisma/schema.prisma`, `prisma/seed.ts` (Agency seed)
- `src/lib/engine.ts` (approval engine), `src/lib/validators.ts`, `src/lib/presets.ts`
- `src/lib/mailer.ts`, `src/lib/emails.ts` (email), `src/lib/security.ts`, `src/proxy.ts` (CSP)
- `src/app/api/leave/balance/route.ts`, `src/components/LeaveBalance.tsx`
- `src/components/TemplateBuilder.tsx`, `WorkflowCanvas.tsx`, `LevelSettingsForm.tsx` (workflow designer)
