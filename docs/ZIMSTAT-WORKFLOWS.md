# How the ZimStat forms map to the system

The four paper forms supplied by the Agency are modelled one-to-one as workflow designs. Every signature box on the paper form is an approval level; the person who signs it is the approver. Administrators can refine any of these under **Workflow designs**.

## 1. Application for Field Duty and Travelling & Subsistence Advance (prefix `TSA`)

| Paper form | System |
| --- | --- |
| Section A: name, E.C./I.D. No, salary grade, section, date | Name and date come from the account; E.C. number, salary grade and section are form fields |
| "May my application for an advance to travel to … for the period … be approved" | Destination + period (date range) |
| Purpose of journey, cost to be borne by (e.g. USAID) | Purpose; funder select; **Project** picker (required) so the advance is counted against the survey budget |
| Section B: breakdown (B&B nights × rate, supplementary, lunch, dinner, field duty, other) | Allowance table with computed totals; standard rates shown as help text |
| "To be completed by the Finance Section: balance on advance account" | Level 2 **Finance Section certification** – any Finance officer; a comment stating the balance is mandatory |
| Section C: declaration by applicant, signature | Mandatory declaration checkbox; submission is the signature (audit-logged with IP and time) |
| Recommended / Not recommended – Head of Section | Level 1 **Head of Section** (the requester's section head) |
| Section D: APPROVED / NOT APPROVED – Director General / Head of Division / Province | Level 3 **Director General or Director Finance** |
| Payment | Level 4 **Disbursement by Finance** records the payout |

Return-for-changes from Finance loops back to the Head of Section (not to the applicant), as on paper.

## 2. Travelling and Subsistence Expense Claim Form (prefix `TSC`)

| Paper form | System |
| --- | --- |
| Claimant surname/initials, I.D., address, email, cell, vendor number, date-stamp | Account name/email + E.C. number, address, cell, vendor number fields; submission time is the date-stamp |
| Period covered by claim; stationed at; camping equipment election | Fields |
| Daily table: date, place from/to, dep/arr, days, field duty, breakfast, lunch, dinner, accommodation, transport, supplementary, other, total, accommodation type | **Daily itinerary** table with a computed row total and footer sum (`itineraryTotal`, used as the claim cost) |
| Own vehicle: registration, km × rate | Own-vehicle fields (shown only when ticked) |
| Less advances received (date, where) → balance payable | **Advances received** table (reference the `TSA-…` request); balance = total claimed − advances |
| Appropriation (cost centre, GL, project), debit/credit | Project picker + funder select; Accounts enters GL/cost centre in the level-2 comment |
| Certified correct – Supervisor / Team Leader | Level 1 **Supervisor / Team Leader** (requester's line manager) |
| Checked / certified not previously paid – For Accountant | Level 2 **Accounts** (any Finance officer; comment mandatory) |
| Passed for payment – Accountant / Deputy Director | Level 3 **Accountant or Director Finance** |
| Examined – Internal Audit / External Audit | Level 4 **Internal Audit** (post-payment; can return to Accounts) |

Receipts are mandatory attachments.

## 3. Application for Leave, Public Service form (prefix `LV`)

| Paper form | System |
| --- | --- |
| Surname, first names, dept & station code, ministry, station | Account + station field |
| Employee code number and check digit ("form will be rejected if incorrect") | Required fields |
| Type of leave: vacation, sick, annual, special, without pay, urgent private affairs; from/to; days | Leave type select, date range, number of days |
| Advance of salary (months) | Checkbox + months (6-week notice shown as help text) |
| Vacating Government accommodation from/to | Checkbox + date range |
| Amended/cancelled form | Free text for original dates |
| Sick leave > 3 days needs a certificate | Help text; attach the certificate |
| Signature of applicant → Recommended → Approved | Level 1 **Supervisor** → Level 2 **Head of Section** → Level 3 **Registry / HR** records and files |

## 4. Application for Annual Leave, off days (prefix `AL`)

| Paper form | System |
| --- | --- |
| Name, number of days, on/from – to (inclusive), signature | Account + days + date range |
| Recommended (supervisor) → Approved (Head of Office) → Recorded and filed (Registry / Admin) | Three levels, same people |
| "cc: out of 12 days annual leave allocated this year you have taken … and are left with a balance of …" | **Leave balance** panel on the request and on the form: entitlement (Settings → Organisation, default 12), taken, pending, remaining; the request is flagged when it exceeds the balance |
| N.B. weekends and public holidays count when combined with vacation leave or when more than six working days are taken | Shown as help text on the form |

## Approver types used

- **Head of Section** – head of the requester's section (set under Sections & divisions).
- **Supervisor / line manager** – the manager set on the officer's profile (People).
- **Section** (new) – any officer in a named section, e.g. Finance Section, Registry, Internal Audit. Use "ALL" mode if every member must sign.
- **Named people** – e.g. Director General, Accountant.

## Roles

| Role | Who at ZimStat |
| --- | --- |
| OWNER | ICT systems administrator (full control, API keys, branding) |
| ADMIN | Director General, Directors (manage people, sections, workflow designs, reports, audit log) |
| MANAGER | Heads of section, supervisors / team leaders, accountant, internal auditor |
| MEMBER | Officers, enumerators, finance and registry clerks |

## 5. Service desk (cases), ported from the local-council issue tracker

Alongside form-based approvals, the **Service desk** handles tickets and public reports: ICT support, system access, facilities, data requests from the public, complaints about field work, finance queries.

| Local-council feature | Here |
| --- | --- |
| Nine-state case lifecycle (new, triaged, assigned, in progress, on hold, resolved, closed, reopened, rejected) | Same statuses. Officers follow the state machine; administrators may move a card between any columns. Every change is written to the timeline with the actor and an optional reason (can be made mandatory). |
| Categories with SLA hours and default priority, routed to a department | **Categories & SLAs** in the Service desk menu: each category belongs to a section; public categories appear on the portal. |
| Auto-assignment to the least-busy active agent, out-of-office backup, default assignee fallback | Least-busy officer in the section (open cases, plus 100 if on an active out-of-office delegation, whose delegate is used instead), then the section's default assignee, then the section head, then an administrator. Optional "section head triages first". |
| Reassignment when staff are deactivated | Open cases move to the least-busy colleague with a timeline entry and a notification. |
| SLA warning (<24 h) and breach | Warning window is configurable; the hourly cron raises a warning to the assignee and a breach escalation to the section head, once each; reopening restarts the clock. |
| Duplicate detection (14 days, same category, address text, <250 m, similar title) | Advisory list while logging a case; "Duplicate of" links and rejects the duplicate and tells the reporter which case is being handled. |
| Optimistic concurrency (version, 409) | Every edit and status change carries the version; a stale version returns 409 and the board reloads. |
| Kanban board with drag-and-drop, table view, filter bar, saved views | **Cases** page: board or table, filters (section, category, assignee, priority, status, SLA breached, my cases), saved views with a default. |
| Slide-over case drawer with inline edits, timeline, internal notes vs public updates, attachments | Same; public updates are emailed to the reporter and shown on the tracking page; files can be marked public or staff-only. |
| Citizen portal: report, track, rate | `/report` (anonymous, categories, location with GPS, up to 3 photos, honeypot and rate limits) and `/track/<ref>` (status, timeline, public updates, rating once resolved, verified by the reporter's phone or email). |
| Branding and portal texts, announcement banner | Settings > Service desk & portal: heading, introduction, contacts, announcement, reference prefix, routing rules, board columns. |
| Analytics summary | KPIs on the board (open, resolution rate, average resolution hours, SLA breached) and `GET /api/cases/stats` (status, priority, source and section breakdowns, 14-day trend). |
| WhatsApp (Twilio/Infobip) intake and sandbox | Re-implemented on the **Meta WhatsApp Business Cloud API** with a button/list driven conversation, approved templates for outbound updates, signed webhooks and an in-app sandbox. Optional and fail-safe. See docs/WHATSAPP.md. |
| Multi-council tenancy, super-admin console, workspaces | Not needed in the single-organisation edition; "workspaces" map to **Projects & surveys**. |
