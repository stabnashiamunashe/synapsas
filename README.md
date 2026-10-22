# FlowDesk — white-label approval workflow SaaS

Next.js 16 (App Router) + Ant Design + Prisma on **MySQL**. The API lives in `src/app/api/*` (route handlers) and the UI in `src/app/*`.

## Quick start

1. Create the database once (any MySQL 8 user with rights on it):

   ```sql
   CREATE DATABASE documentdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Put your credentials in `.env`:

   ```
   DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/documentdb"
   ```

3. Install, create the tables and seed the demo workspace:

   ```bash
   npm install
   npm run setup      # prisma db push + seed
   npm run dev        # http://localhost:3000
   ```

For production use migrations instead of `db push`: `npx prisma migrate dev --name init` locally, then `npx prisma migrate deploy` on the server.

Demo workspace **acme** (password for all: `Password123!`):

| Email                    | Role    | Used for                                   |
| ------------------------ | ------- | ------------------------------------------ |
| owner@acme.test          | OWNER   | Everything, billing, branding              |
| cfo@acme.test            | ADMIN   | CFO level on requisitions ≥ $5,000         |
| ops.head@acme.test       | MANAGER | Head of Operations (department-head level) |
| manager@acme.test        | MANAGER | Line manager of the members                |
| procurement@acme.test    | MANAGER | Procurement review level                   |
| legal@acme.test          | MANAGER | Legal sign-off (ALL mode)                  |
| member@acme.test         | MEMBER  | Raises requests                            |
| jane@acme.test           | MEMBER  | Raises requests                            |

Tenant-branded login: `/login?org=acme`.

## Deploying with Docker (recommended)

The stack in `docker-compose.yml` runs three containers: the app (UI + API, published on host port **3443**), MySQL 8, and Caddy, which terminates HTTPS for the domain on ports 80/443 with automatic Let's Encrypt certificates.

One-time setup on an Ubuntu VM:

```bash
curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER && newgrp docker
git clone https://github.com/stabnashiamunashe/synapsas.git synapsas && cd synapsas
cp .env.docker.example .env.docker && nano .env.docker   # DB passwords, AUTH_SECRET, PLATFORM_ADMIN_KEY, DOMAIN, APP_URL
docker compose up -d --build
docker compose --profile seed run --rm seed              # optional: demo workspace, first time only
```

Open the firewall for 80, 443 and 3443 (`sudo ufw allow 80,443,3443/tcp`). Every later release is one command:

```bash
bash scripts/deploy-docker.sh
```

| URL | Served by |
| --- | --- |
| `https://synapsas.tech` | Caddy → app (HTTPS, certificate auto-renewed) |
| `http://<vm-ip>:3443` | app directly, plain HTTP |

### Pointing synapsas.tech at the VM (Hostinger)

In Hostinger hPanel open **Domains → synapsas.tech → DNS / Name Servers → DNS records** and set:

| Type | Name | Points to | TTL |
| --- | --- | --- | --- |
| A | `@` | `<VM public IP>` | 300 |
| A | `www` | `<VM public IP>` | 300 |

Delete any other `A` or `AAAA` records for `@` and `www` (Hostinger adds parking records by default). Propagation usually takes a few minutes; check with `dig +short synapsas.tech`. Caddy requests the certificate automatically the first time the name resolves to the VM, so start the stack after the records are in place, or run `docker compose restart caddy` afterwards.

Useful commands: `docker compose logs -f app`, `docker compose exec db mysql -u root -p documentdb`, `docker compose down` (data stays in the `db_data` and `uploads` volumes).

## Deploying on an Ubuntu server without Docker

One-time setup (Node 20+, MySQL 8, git, pm2):

```bash
sudo apt update && sudo apt install -y git mysql-server
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2
sudo mysql -e "CREATE DATABASE documentdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'synapsas'@'localhost' IDENTIFIED BY 'CHANGE-ME'; GRANT ALL ON documentdb.* TO 'synapsas'@'localhost';"
git clone https://github.com/<you>/<repo>.git synapsas && cd synapsas
cp .env.example .env && nano .env     # DATABASE_URL, AUTH_SECRET, APP_URL, PLATFORM_ADMIN_KEY
SEED=1 bash scripts/deploy.sh         # SEED=1 only the first time, to load the demo workspace
pm2 startup                           # follow the printed command so pm2 restarts on reboot
```

Every later release is one command from the project folder:

```bash
bash scripts/deploy.sh
```

It pulls `master`, runs `npm ci`, pushes the Prisma schema to MySQL, builds, and restarts the `synapsas` pm2 process on port 3000 (`PORT=8080 bash scripts/deploy.sh` to change it). Put nginx or Caddy in front for HTTPS and point `APP_URL` at the public address.

## What is included

- **Multi-tenant workspaces** with OWNER / ADMIN / MANAGER / MEMBER roles, departments, line managers, invitations.
- **Workflow builder** (`/app/templates`): custom form fields (text, number, currency, date, select, person/department pickers, headings) and **line-item tables with user-defined columns**, computed columns (`quantity * unitPrice`), footer sums and a total that conditions can reference.
- **Configurable approval levels**: any number of levels; approver = specific users, role (optionally within requester's department), requester's manager, department head, person chosen on the form, or head of a department chosen on the form. ANY/ALL mode, SLA hours, escalation target, fallback approver, skip-if-requester, require-comment, allow delegate/return, and a **condition** per level (e.g. run the CFO level only when `itemsTotal >= 5000`).
- **Request lifecycle**: draft → submit → approve / reject / return-for-changes / delegate → resubmit; cancel; attachments; comments; print view; CSV export.
- **Out-of-office delegation**, SLA **escalation job** (`POST /api/cron/escalate` with `CRON_SECRET`, or "run sweep" in Settings → Organisation).
- **Notifications** (in-app, email hook in `src/lib/notify.ts`), **signed webhooks**, **API keys** (`Authorization: Bearer wf_…` on any `/api/*` route).
- **White-label**: product name, logo, favicon, primary colour, sidebar theme, login tagline/background, footer, hide vendor branding, custom domain (branding resolved by `Host`).
- **Plans & limits** (Free / Starter / Business / Enterprise) enforced on users, workflows, monthly requests, storage, API, webhooks, white-label, custom domain. Billing provider hook in `src/app/api/org/plan/route.ts`.
- **Reports** (volume, approval rate, slowest levels, approver activity), **dashboard**, **audit log**.

## Brand

Platform brand is **Synapsas**: deep green `#003B32`, cream `#FFFDF0`, black, white. Official artwork lives in `public/images`; trimmed copies used by the UI are in `public/brand` (`logo-black.png`, `logo-white.png`, `mark-black.png`, `mark-white.png`) and `public/favicon.png`. `src/components/BrandMark.tsx` picks the light or dark file from the colour it is given. Tenants override colours and logo under Settings → Branding. The marketing site lives in `src/components/Landing.tsx` with `src/app/landing.css`.

## Projects and cost aggregation

- **Project** (`Project` table): code, name, status (`ACTIVE | ON_HOLD | CLOSED | ARCHIVED`), budget, currency, owner, period. Managers create them under **Projects**; closed/archived projects refuse new requests but keep their spend.
- **Cost on a request**: each workflow declares a *cost field* under Rules (a line-item table total such as `itemsTotal`, or a currency field; auto-detected when unset, or "no cost"). `extractCost()` stores it in `Request.costAmount` on save and submit, so totals survive later template edits.
- **Aggregation** (`src/lib/projects.ts`): approved spend, pending (in approval), drafts, rejected, budget remaining before and after pending, utilisation, plus breakdowns by workflow and month. `GET /api/projects` lists with summaries; `GET /api/projects/:id` returns the full picture and the request list; `GET /api/projects/:id/export` is a CSV for finance.
- Requests pick a project when raised (`projectId`; optional unless the workflow sets **Require a project**), can be filtered by project in the list, and link to the project from their detail page.
- `node scripts/projects-smoke.mjs` (set `BASE` to the dev server) exercises create → raise with line items → approve/reject → totals → CSV → closed-project guard.

## Billing, onboarding and enforcement

**Lifecycle** (`src/lib/billing/index.ts`): signup starts a 14-day Business trial (`TRIALING`) → subscribe to become `ACTIVE` → when a paid period ends without renewal the workspace is `PAST_DUE` with a 7-day grace window → after grace it is **locked** (read-only: every write except billing/auth returns HTTP 402) until an invoice is paid. Trials that lapse become `EXPIRED` on Free limits (data kept, nothing above Free can be added). `CANCELLED` ends access at the period close.

**Entitlements** are computed, never trusted from `org.plan` alone: `entitlementsFor(org)` returns the plan in effect, lock state and a banner; every limit check uses `limitsFor(effectivePlan(org))`. `GET /api/billing/status` gives the billing page usage, over-limit flags and the open invoice.

**Providers** — set `BILLING_PROVIDER`:

| Provider | How it pays | Confirmation |
| --- | --- | --- |
| `stripe` | Stripe Checkout (card). Set `STRIPE_PRICE_<PLAN>_<MONTHLY|YEARLY>` for true recurring subscriptions, otherwise one-off period payments. | Webhook `/api/billing/webhooks/stripe` (`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.*`) with `STRIPE_WEBHOOK_SECRET`. Customer portal via `/api/billing/portal`. |
| `paynow` | Paynow Zimbabwe: web checkout, or EcoCash/OneMoney prompt to a phone. `PAYNOW_INTEGRATION_ID/KEY`. | Result URL `/api/billing/paynow/result` (hash-verified) plus polling on the invoices page and in the cron. |
| `manual` | Bank transfer: an invoice with `BILLING_BANK_DETAILS` and the invoice number as reference. | Operator confirms in the platform console. |

**Invoices** (`Invoice` table): one per checkout or renewal, numbered `INV-YYYY-NNNNNN`, states `PENDING → PAID | FAILED | VOID`. `settleInvoice` is idempotent and extends from the current period end. Yearly billing = 10 months.

**Cron**: `POST /api/cron/billing` hourly with `Authorization: Bearer $CRON_SECRET` expires trials, raises renewal invoices, applies grace/lock and polls Paynow.

**Platform console**: `/platform` (enter `PLATFORM_ADMIN_KEY`) lists all workspaces, marks bank-transfer invoices paid, overrides plans/status (comped accounts) and runs the sweep. API: `GET/POST /api/admin/billing` with header `x-platform-key`.

**Onboarding**: new owners are redirected to `/app/onboarding` (organisation details, team invitations, workflow presets, plan overview) until `onboardingCompletedAt` is set.

`node scripts/billing-smoke.mjs` exercises trial → manual invoice → operator mark-paid → lock → unlock end to end.

## Security model

- **Passwords**: bcrypt (cost 12); policy of 10+ chars with upper, lower and digit, common-password and name/email checks, enforced server-side. Admin-created or admin-reset passwords are temporary and force a change at next sign-in.
- **Brute force**: per-IP and per-IP+email rate limits on sign-in; account lockout for 15 minutes after N failures (N configurable per workspace, default 5); admins can unlock from People. Failed and blocked attempts are audited with IP and user agent.
- **Two-factor authentication**: TOTP (RFC 6238) with QR enrolment, 10 one-time backup codes, disable requires password + code. Workspaces can require 2FA for owners/admins.
- **Sessions**: HttpOnly, SameSite=Lax, Secure-in-production JWT cookie with a per-workspace lifetime; every authenticated request is checked against the database (active user, session version), so deactivation, password change and "sign out everywhere" take effect immediately.
- **CSRF**: mutating requests from cookie sessions must carry a same-origin `Origin`/`Referer`. API keys are exempt (bearer auth).
- **Password reset**: single-use hashed tokens valid for 1 hour, non-enumerating response, all sessions revoked on reset.
- **Headers**: CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS in production (`next.config.ts`).
- **Errors**: server errors never leak stack traces or driver messages to clients.
- **Audit**: sign-ins, failures, lockouts, 2FA changes, password changes, session revocations, exports and every workflow action, with IP and user agent; filter by category/date and export to CSV.

Run `node scripts/security-smoke.mjs` against a running dev server to exercise lockout, unlock, CSRF, 2FA, revocation and password policy end to end.

## Key files

| Path                                   | Purpose                                         |
| -------------------------------------- | ----------------------------------------------- |
| `prisma/schema.prisma`                 | Data model (SQLite by default; switch provider) |
| `src/lib/engine.ts`                    | Workflow engine: routing, actions, escalation   |
| `src/lib/formula.ts`                   | Safe formula evaluator, conditions, totals      |
| `src/lib/types.ts`                     | Field / level / settings types                  |
| `src/lib/validators.ts`                | Zod schemas for every API payload               |
| `src/components/TemplateBuilder.tsx`   | Workflow designer (fields, levels, rules)       |
| `src/components/DynamicForm.tsx`       | Renders any template as an antd form            |
| `src/components/TableField.tsx`        | Editable line-item table with computed columns  |

## API overview

All JSON responses are `{ ok, data }` or `{ ok: false, error, details }`.

| Method | Route                              | Notes                                       |
| ------ | ---------------------------------- | ------------------------------------------- |
| POST   | /api/auth/register · login · logout | Cookie session (JWT)                       |
| GET    | /api/auth/me                       | Current user, org, branding, limits         |
| GET/PATCH | /api/org                        | Organisation, branding, settings            |
| GET/POST | /api/templates, /api/templates/:id (GET/PUT/PATCH/DELETE), /:id/duplicate |    |
| GET/POST | /api/requests                    | List (filters: status, templateId, scope, q) / create (`submit: true` to submit) |
| GET/PATCH/DELETE | /api/requests/:id        | Detail, edit draft, delete draft / cancel   |
| POST   | /api/requests/:id/submit · action · cancel · comments · attachments | action = APPROVE / REJECT / RETURN / DELEGATE |
| GET    | /api/inbox · /api/dashboard · /api/reports · /api/audit · /api/requests/export |  |
| …      | /api/users, /api/users/invite, /api/invitations, /api/departments, /api/notifications, /api/api-keys, /api/webhooks, /api/delegations |  |
| POST   | /api/cron/escalate                 | SLA sweep, `Authorization: Bearer CRON_SECRET` |

## Production notes

- Set a strong `AUTH_SECRET` and `CRON_SECRET`; set `APP_URL`.
- MySQL is the configured provider. Large JSON-text columns use `@db.Text` / `@db.LongText`; use `utf8mb4` so emoji icons in workflow names store correctly.
- Attachments are stored on local disk under `UPLOAD_DIR`; swap for S3/GCS in `src/app/api/requests/[id]/attachments/route.ts` and `src/app/api/attachments/[id]/route.ts`.
- Wire email in `notify()` (Resend/SES/SMTP) and payments in `/api/org/plan`.
