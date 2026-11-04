# Local authority edition (Ruwa Local Board)

This branch (`local-authority`) is the council edition of the approvals platform. It keeps every module of the ZimStat edition (approval workflows, service desk with public portal and WhatsApp, advances ledger, leave calendar, notice board, asset register, fleet) and adds a **licensing module**, council-flavoured sample data and **Ruwa Local Board** branding.

## Branding

| Token | Value | Where it comes from |
| --- | --- | --- |
| Primary (council green) | `#1E7B34` | Crest shield and ribbon |
| Deep green (navigation shell) | `#0E3B1F` | Darkened crest green; IBM Carbon gray-100 layout rules |
| Leaf green (secondary KPI accent) | `#3FA34D` | Crest leaves |
| Gold (selection bar, warning KPI accent) | `#F2B705` | Crest banner "RUWA" |
| Surfaces | Carbon gray-10 `#f4f4f4`, gray-20 borders | IBM style guide |

The crest is `public/brand/ruwa-logo.jpg`. Defaults live in `src/components/Providers.tsx` (`DEFAULT_BRANDING`, `SHELL_DARK`, `BRAND`) and `src/app/globals.css` (`--brand-color`, `.stat-*` accents). Everything can still be overridden per organisation under **Settings → Branding**.

Informational blue (`#0f62fe`) is kept for info alerts and focus rings so that green always means *approved / valid / available*.

## Colour-coded statuses and priorities

One registry, `src/components/StatusTag.tsx`, renders every status and priority as a tinted pill with a dot, so a colour always means the same thing across requests, cases, advances, assets, fleet and licences:

| Colour | Meaning | Examples |
| --- | --- | --- |
| Green | done, valid, available | Approved, Resolved, Cleared, Issued, Valid, Available |
| Blue | in hand | Assigned, Under review, Partly cleared, On a trip, Issued (asset) |
| Amber | waiting on someone | Pending review, In progress, Open advance, Expired, Needs vehicle |
| Orange | paused | Returned, On hold, Suspended |
| Red | failed, overdue, stopped | Rejected, Escalated, Revoked, Lost, Overdue |
| Purple | inspection or delegation | Triaged, Inspection, Delegated, On the road |
| Teal | approved, formality pending | Approved · fee due |
| Grey | inactive | Draft, Cancelled, Closed, In store, Disposed |

Priorities use one scale for all modules: **Low** green, **Normal/Medium** blue, **High** orange, **Urgent/Critical** red.

## Licensing module

### Data

- **Licence types** (`LicenceType`): code (`SHP`, `LIQ`, `HWK`, `FHP`, `BLD`, `TPT`, `ADV`, `ECD` seeded), category, fee and currency, validity in months, whether an inspection is required, the owning department (its head is notified and approves), and the list of required documents.
- **Licences** (`Licence`): one row per application. Reference `LA-<year>-nnnn`; once issued also a licence number `RLB/<code>/<year>/nnnn` (prefix from organisation settings `licensing.prefix`). Holds applicant, trading name, ID, contact, stand/address/ward, activity, priority, fee and receipt, officer, inspector and inspection outcome, conditions, decision note, validity dates, the document checklist and a link to the licence it renews.
- **Events** (`LicenceEvent`): full timeline (submitted, review, inspection scheduled/recorded, approved, rejected, paid, issued, renewed, suspended, reinstated, revoked, expired, cancelled, notes, document updates).

### Lifecycle

```
SUBMITTED → UNDER_REVIEW → INSPECTION → UNDER_REVIEW → APPROVED → ISSUED → (EXPIRED | SUSPENDED | REVOKED)
                 │                                         │                     │
                 └──────────── REJECTED / CANCELLED ───────┘                     └── renew → new SUBMITTED application
```

- A type that **requires inspection** cannot be approved until an inspection has been recorded (administrators may override). A **failed** inspection keeps the application under review and offers a re-inspection; the UI's primary button always suggests the next sensible step.
- **Approve / reject / issue / suspend / reinstate / revoke / cancel** need a manager or administrator. Officers can review, schedule and record inspections, record payments, tick documents and add notes. The assigned inspector (or a manager) records the result.
- **Issue** requires a recorded fee (or a receipt number on the issue dialog), allocates the licence number, sets validity from the chosen start date, and makes the **Certificate** button available (printable HTML with the crest, a VALID/EXPIRED stamp, conditions and signature lines; print to PDF from the browser).
- **Renew** opens a new linked application with the applicant's details and the *current* fee, leaving the old licence on record.
- **Expiry sweep**: the cron endpoint (`/api/cron/escalate`) marks lapsed licences `EXPIRED` and sends a reminder to the officer, inspector and department head 30 days before expiry (at most once a week per licence).

### Screens

| Route | Who | Purpose |
| --- | --- | --- |
| `/app/licences` | everyone | Register with KPI tiles (awaiting action, inspections, issued, expiring, fees collected this year, suspended/revoked), scopes (*Needs action, Issued, Expiring, Mine, All*), search and filters, CSV export, and the record drawer with actions, document checklist and history. |
| `/app/licences/new` | everyone | Log an application; fee, validity and checklist come from the chosen type. |
| `/app/licences/types` | administrators | Fee schedule: add or edit licence types; deleting a type with history deactivates it. |
| `/verify` | public | Check a licence number printed on a certificate. |
| `/api/licences/:id/certificate` | signed-in | Printable certificate. |

The dashboard shows a licensing strip (applications awaiting action, items assigned to you, licences expiring within 30 days). Everything is searchable from the command palette (Ctrl K): "licence", "permit", "fees", "verify".

### API

| Method & path | Notes |
| --- | --- |
| `GET /api/licence-types[?all=1]` · `POST` · `PATCH/DELETE /api/licence-types/:id` | Admin for writes. |
| `GET /api/licences?status=&open=1&typeId=&category=&ward=&mine=1&expiring=30&q=&format=csv` | Returns items, counts per status, expiring count, fees receipted this year. |
| `POST /api/licences` | Log an application. |
| `GET/PATCH /api/licences/:id` | Detail with events and renewals; edit applicant details, priority, officer, documents. |
| `POST /api/licences/:id` | `{ action }` = `review`, `schedule_inspection`, `record_inspection`, `approve`, `reject`, `pay`, `issue`, `renew`, `suspend`, `reinstate`, `revoke`, `cancel`, `note`, `document` with the fields each needs (inspectorId/inspectionDue, outcome/conditions, receiptNo/amount/paidAt, issuedAt/validityMonths, note, documents). |
| `GET /api/public/licence-verify?no=` | Public lookup. |

## Sample data

`npm run db:seed` creates the council (slug `ruwa`), seven departments, 16 officers (`docs/TEST-ACCOUNTS.md`), devolution and recurrent budget votes, the T&S, leave, memo and vehicle workflows, council service-desk categories (water & sewer, roads & lighting, refuse, licensing queries, rates & billing), the eight licence types and 12 licences covering every status (issued, expiring within 30 days, expired, suspended, approved awaiting payment, at inspection, under review after a failed inspection, submitted, rejected).

## Deployment

Same Docker compose stack as the ZimStat edition. For a fresh council database:

```bash
git clone -b local-authority https://github.com/stabnashiamunashe/synapsas.git && cd synapsas
cp .env.example .env   # set DB passwords, APP_URL, SMTP, CRON_SECRET
docker compose up -d --build
docker compose --profile seed run --rm seed
```

For an existing database created from this branch, `docker compose run --rm app npx prisma db push` adds the licensing tables without touching data. Schedule `GET /api/cron/escalate` with `Authorization: Bearer $CRON_SECRET` nightly so licences expire and reminders go out.
