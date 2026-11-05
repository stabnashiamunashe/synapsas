# Local authority edition (Municipality of Chitungwiza)

This branch (`chitungwiza`, cut from `local-authority`) is the council edition of the approvals platform. It keeps every module of the ZimStat edition (approval workflows, service desk with public portal and WhatsApp, advances ledger, leave calendar, notice board, asset register, fleet) and adds a **licensing module**, council-flavoured sample data and **Municipality of Chitungwiza** branding.

## Branding

| Token | Value | Where it comes from |
| --- | --- | --- |
| Primary (council rust) | `#B5491A` | Shield orange `#E8731A` darkened for 4.5:1 contrast on white; buttons, links, focus ring |
| Deep brown (navigation shell) | `#3A1708` | Crest ribbon, darkened; IBM Carbon gray-100 layout rules |
| Field green (secondary KPI accent) | `#3C7D2C` | Green field with the tree |
| Gold (selection bar, warning KPI accent) | `#D9A441` | Mural crown and spear |
| Wordmark blue | `#2238A4` | "CHITUNGWIZA" wordmark; reserved, not used in the UI so that blue keeps meaning *information* |
| Surfaces | Carbon gray-10 `#f4f4f4`, gray-20 borders | IBM style guide |

The crest is `public/brand/chitungwiza-logo.png`. Defaults live in `src/components/Providers.tsx` (`DEFAULT_BRANDING`, `SHELL_DARK`, `BRAND`) and `src/app/globals.css` (`--brand-color`, `.stat-*` accents). Everything can still be overridden per organisation under **Settings → Branding**.

Informational blue (`#0f62fe`) is kept for info alerts so that green in a status always means *approved / valid / available*. Focus rings are a single 1px line in the brand rust (`--focus` in `globals.css`, `UI.focus` in `Providers.tsx`); inputs inside an affix wrapper (search boxes, fields with icons) never draw a second inner ring.

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
- **Licences** (`Licence`): one row per application. Reference `LA-<year>-nnnn`; once issued also a licence number `CMC/<code>/<year>/nnnn` (prefix from organisation settings `licensing.prefix`). Holds applicant, trading name, ID, contact, stand/address/ward, activity, priority, fee and receipt, officer, inspector and inspection outcome, conditions, decision note, validity dates, the document checklist and a link to the licence it renews.
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

### Citizen channels

Applications arrive three ways and all go through one creation path (`createLicenceApplication` in `src/lib/licensing.ts`), so numbering, checklists, officer routing and applicant notices are identical. The register and the record drawer show a **Portal** or **WhatsApp** tag on applications that did not come over the counter.

| Channel | How a citizen applies | Tracking and documents |
| --- | --- | --- |
| **Counter** (`source = STAFF`) | An officer logs it on *New licence application*. | Officer ticks documents as they are handed in. |
| **Public portal** (`source = PUBLIC`) | `/apply`: choose a licence (fee, validity, required documents shown), fill in applicant and premises, attach documents against each requirement, accept the declaration. No account; honeypot and 10 applications per hour per IP. The applicant gets a reference `LA-<year>-nnnn`. | `/verify` → *Track my application* with the reference and the phone number (or email) given on the application: status, next step, fee due, document checklist with upload buttons (uploads tick the officer checklist), public timeline, licence number and expiry once issued. |
| **WhatsApp** (`source = WHATSAPP`) | Main menu → *Apply for a licence* (or type **licence**): pick the licence from a list, give the applicant name, trading name, premises, ward and a description, confirm. The bot replies with the reference, the documents to bring or upload, the fee and the inspection notice. | *My licence applications* (or type **my licences**) lists the applications from that phone number with status, fee due or licence number. Applications are matched to the phone number, so another number cannot see them. |

**Applicant notifications** (`notifyApplicant`): received, inspection scheduled, approved with the fee to pay, issued with the licence number and expiry, rejected with the reason, suspended, revoked. WhatsApp applicants get them on WhatsApp (through an approved template once `WHATSAPP_TEMPLATE_LICENCE_UPDATE` or the case-update template is configured; in the sandbox they appear in the message log as *simulated*). Applicants who gave an email address get the same text by email when SMTP is configured. Expiry reminders also go to WhatsApp applicants 30 days before a licence lapses.

**Uploaded documents** are stored under `UPLOAD_DIR/<org>/licences`, limited to photos and PDFs of 8 MB, at most 15 per application, and are listed in the record drawer under *Uploaded by the applicant* (download via `/api/licence-attachments/:id`, staff only). Uploads need the token returned by the application or the tracking lookup, so only someone who knows the reference and the phone number can add files.

Switch the portal off with `settings.licensing.portal = false` on the organisation; the WhatsApp licensing flow follows the *Accept reports on WhatsApp* switch.

### Application forms (per licence type)

Each licence type carries its own **application form** and a **"for office use only" section**, edited under *Licensing → Licence types, fees & forms* (administrators). Forms use the same field designer as workflow templates: short text, paragraph, number, currency, date, dropdown, multi-select, checkbox, line-item table, section headings, help text, required flags and *show only when* conditions (for example rural premises details only when the premises are rural). The applicant always gives name, ID, phone, email, stand, address, ward and a description of the business; the form adds the questions specific to that licence. The same form is rendered on the counter page, the public portal and the record drawer; office-use questions are never shown to the public and are filled in by officers from the drawer (*Office use*).

The seed transcribes the council's paper forms (`prisma/licence-forms.ts`, applied by `npx tsx prisma/seed-licence-forms.ts`, also safe on an existing database):

| Licence type | Paper form | Sections |
| --- | --- | --- |
| Shop licence (SHP) | Shop Licence Act [Chapter 14:17], *Application for a new licence* | Type of application (new, extension, removal, alteration), particulars of applicant, person in effective control, convictions, description of the trade (goods, class, method of sale, wholesale/retail), sequestration, situation of premises (urban/rural), premises not yet erected, vending machines, other authorities, advertisement; notes on fees, attachments and penalties. Office use: NA / R / C of O, registration reference, year ending, town planning report, EHO report. |
| Registration of business premises (REG) | Municipality of Chitungwiza (Registration of Premises) By-laws | Type of licence, year ending 31 December, postal address. Office use: NA / R / C of O, ref, town planning report request, EHO report and date. |
| General application (GA) | General Application Form | Application for, details of applicant (date of birth, marital status, spouse and employer, addresses, previous employer, telephones, source of income), trade references (table), bankers, directors, lease. Office use: date received, application fee, receipt number, application number GA/nn/year, allocation reference. |
| Liquor licence (LIQ), Food handling (FHP) | council practice | Short forms (kind of licence, trading hours, Liquor Licensing Board reference; type of food business, handlers, water supply). |

Each type also lists the **types of application** it offers (new, renewal, extension, removal, alteration, change of ownership); the applicant picks one at the top of the form and it is shown on the register.

### Payment confirmation

Fees are tracked in a **payment ledger** per application (`LicencePayment`), not as a single receipt field:

1. Once an application is **approved**, the applicant is told the fee and how to pay (cashier, EcoCash, bank transfer). The portal tracking page and the WhatsApp bot (*I have paid*) let the applicant report the payment: method, transaction reference or receipt number, amount, date and an optional proof-of-payment upload. The cashier records counter payments from the record drawer (*Record payment*).
2. Every payment starts as **awaiting confirmation**. The register's *Payments* scope and the *Payments to confirm* tile list them; Finance (members of the Finance department) or a manager **confirms** it against the cashbook or **rejects** it with a reason. The person who recorded a payment cannot confirm it unless they are a manager; a manager or Finance officer recording a counter receipt can tick *confirm immediately*.
3. The licence can be **issued only when confirmed payments cover the fee**. Confirmation stamps the licence as paid (receipt = the payment reference), notifies the applicant ("payment confirmed"), and *Fees confirmed this year* on the register counts only confirmed money. Rejections notify the applicant with the reason so they can correct the reference.

### Screens

| Route | Who | Purpose |
| --- | --- | --- |
| `/app/licences` | everyone | Register with KPI tiles (awaiting action, inspections, issued, expiring, fees collected this year, suspended/revoked), scopes (*Needs action, Issued, Expiring, Mine, All*), search and filters, CSV export, and the record drawer with actions, document checklist and history. |
| `/app/licences/new` | everyone | Log an application; fee, validity and checklist come from the chosen type. |
| `/app/licences/types` | administrators | Fee schedule and form designer: add or edit licence types, their application form, office-use section and application kinds; deleting a type with history deactivates it. |
| `/apply` | public | Citizen self-service application with document upload. |
| `/verify` | public | Track an application (reference + phone) or check a licence number printed on a certificate. |
| `/api/licences/:id/certificate` | signed-in | Printable certificate. |

The dashboard shows a licensing strip (applications awaiting action, items assigned to you, licences expiring within 30 days). Everything is searchable from the command palette (Ctrl K): "licence", "permit", "fees", "verify".

### API

| Method & path | Notes |
| --- | --- |
| `GET /api/licence-types[?all=1]` · `POST` · `PATCH/DELETE /api/licence-types/:id` | Admin for writes. |
| `GET /api/licences?status=&open=1&typeId=&category=&ward=&mine=1&expiring=30&q=&format=csv` | Returns items, counts per status, expiring count, fees receipted this year. |
| `POST /api/licences` | Log an application. |
| `GET/PATCH /api/licences/:id` | Detail with events and renewals; edit applicant details, priority, officer, documents. |
| `POST /api/licences/:id` | `{ action }` = `review`, `schedule_inspection`, `record_inspection`, `approve`, `reject`, `pay` (method, reference, amount, paidAt, payerName, confirm), `confirm_payment` / `reject_payment` (paymentId, note), `issue`, `renew`, `suspend`, `reinstate`, `revoke`, `cancel`, `note`, `document`, `office` (officeData). |
| `GET /api/public/licence-verify?no=` | Public licence check. |
| `GET /api/public/licensing` · `POST /api/public/licences` · `GET /api/public/licences/:ref?phone=` · `POST /api/public/licences/:ref/attachments` · `POST /api/public/licences/:ref/payments` | Public catalogue (with each type's form), citizen application (standard fields + `data` answers), tracking, document upload and payment reporting (token in `x-upload-token`). |

## Sample data

`npm run db:seed` creates the council (slug `chitungwiza`), seven departments, 16 officers (`docs/TEST-ACCOUNTS.md`), devolution and recurrent budget votes, the T&S, leave, memo and vehicle workflows, council service-desk categories (water & sewer, roads & lighting, refuse, licensing queries, rates & billing), the eight licence types and 12 licences covering every status (issued, expiring within 30 days, expired, suspended, approved awaiting payment, at inspection, under review after a failed inspection, submitted, rejected).

## Deployment

Same Docker compose stack as the ZimStat edition. For a fresh council database:

```bash
git clone -b local-authority https://github.com/stabnashiamunashe/synapsas.git && cd synapsas
cp .env.example .env   # set DB passwords, APP_URL, SMTP, CRON_SECRET
docker compose up -d --build
docker compose --profile seed run --rm seed
```

For an existing database created from this branch, `docker compose run --rm app npx prisma db push` adds the licensing tables without touching data. Schedule `GET /api/cron/escalate` with `Authorization: Bearer $CRON_SECRET` nightly so licences expire and reminders go out.
