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
