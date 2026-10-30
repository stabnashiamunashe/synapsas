# ZimStat demo accounts

Loaded by the seed (`docker compose --profile seed run --rm seed`, or `npm run db:seed` locally). All names are fictional.

Sign-in page: `https://<your-host>/login` (locally `http://localhost:3000/login`).

**Password for every account: `Password123!`**

| Email | Name | Role | Position | Section | Reports to |
| --- | --- | --- | --- | --- | --- |
| ict.admin@zimstat.co.zw | Tendai Moyo | OWNER | ICT Systems Administrator | ICT Section | Head of ICT |
| dg@zimstat.co.zw | Dr. Rufaro Chikwanha | ADMIN | Director General | Office of the DG | – |
| director.finance@zimstat.co.zw | Nyasha Dube | ADMIN | Director, Finance & Administration (head of Finance Section) | Finance | DG |
| accountant@zimstat.co.zw | Farai Ncube | MANAGER | Accountant | Finance | Director Finance |
| finance.officer@zimstat.co.zw | Rudo Mutasa | MEMBER | Finance Officer (advances / cashier) | Finance | Accountant |
| hr.head@zimstat.co.zw | Chipo Mlambo | MANAGER | Head of Human Resources (head of HR & Admin) | HR & Administration | DG |
| registry@zimstat.co.zw | Blessing Sibanda | MEMBER | Registry Clerk | HR & Administration | Head of HR |
| internal.audit@zimstat.co.zw | Tapiwa Gumbo | MANAGER | Internal Auditor (head of Internal Audit) | Internal Audit | DG |
| ict.head@zimstat.co.zw | Kudzai Mhlanga | MANAGER | Head of ICT Section | ICT Section | DG |
| surveys.head@zimstat.co.zw | Tariro Chigumba | MANAGER | Head of Population Census & Surveys Division | Surveys | DG |
| field.supervisor@zimstat.co.zw | Munyaradzi Zvobgo | MANAGER | Field Supervisor / Team Leader | Surveys | Head of Surveys |
| l.officer@zimstat.co.zw | Leonard Officer | MEMBER | Statistical Officer | ICT Section | Head of ICT |
| p.officer@zimstat.co.zw | Pamela Officer | MEMBER | Enumerator Supervisor | Surveys | Field Supervisor |

## Walk-throughs

| Flow | Raise as | Then act as |
| --- | --- | --- |
| T&S advance (TSA) | l.officer | ict.head (recommend) → finance.officer or accountant (certify balance, comment required) → dg or director.finance (approve) → finance.officer (disburse) |
| T&S expense claim (TSC) | p.officer, attach receipts | field.supervisor (certify) → any Finance officer (checked / not previously paid) → accountant or director.finance (pass for payment) → internal.audit (examine) |
| Application for Leave (LV) | p.officer | field.supervisor (recommend) → surveys.head (approve) → registry (record and file) |
| Annual leave / off days (AL) | l.officer | ict.head (recommend) → ict.head (approve; same person as section head) → registry (record). The balance panel shows 9 of 12 days remaining after the seeded 3-day leave |
| Service desk | l.officer logs a case under ICT support; it is auto-assigned to the least-busy ICT officer | drag it across the board as ict.head or the assignee; add a public update; resolve; rate it from /track as the reporter |
| Public portal | open /report without logging in, pick "Statistical data request", give a phone or email | surveys.head or p.officer sees it on the board; the reporter tracks it at /track |
| WhatsApp (sandbox) | Settings → WhatsApp as ict.admin: send “Hi”, tap Report an issue → category → type a description → Skip → Stay anonymous → Submit | the case appears on the board with source WhatsApp; Track a report lists it |
| Internal memo | anyone | section head → DG (only when "Requires Director General's approval" is ticked) |
| Advances ledger | ict.admin or director.finance: Resources → Advances ledger. TSA-…-0001 (Leonard Officer, USD 870) is open and overdue | record a cash refund or salary recovery with "Clear"; raise and approve a new TSA as above and watch an advance open; raise a TSC as l.officer listing that reference under "Advances received", attach a receipt, approve through ict.head → director.finance (×2) → internal.audit and the advance is cleared |
| Leave calendar | anyone: Work → Leave calendar; February shows Leonard's approved leave, December shows Pamela's pending application | as hr.head or ict.admin open the Leave register tab and export CSV; add public holidays under Settings → Organisation |
| Notice board | anyone: the pinned circular and the ICT policy need acknowledgement; the home page lists them | press "I have read and understood"; as ict.admin open Manage, create a notice for one section with acknowledgement required, then open it to see who is outstanding |
| Asset register | ict.admin or ict.head: Resources → Asset register (10 items; ZS/ICT/0041 is in repair and linked to the Wi-Fi case) | issue ZS/ICT/0043 to an officer, return it, send it for repair; as l.officer see "Issued to me"; link an asset from a case's Details tab |
| Fleet & trips | hr.head, surveys.head or ict.admin: Resources → Fleet & trips. VR-…-0001 is waiting for a vehicle | Assign GZ 4471 or GZ 4472 (GZ 3310 is in maintenance), Start with the odometer, Complete with the closing reading and fuel; submit a new Vehicle request as p.officer and approve as surveys.head → registry to see it arrive on the board |

Seeded data: five service-desk cases (ZS-…-0001 to 0005: data request, ICT, access, facilities, field complaint); one approved TSA (Kadoma, USD 870, ZDHS project), one TSC awaiting Accounts (MICS), one approved 3-day annual leave, one vacation leave awaiting the supervisor.

## Notes

- Seed passwords are public. Reset or deactivate these accounts before go-live, or run without the seed and create staff under People.
- Two-factor authentication is off for every seed account; enable it under Profile → Security.
- The seed is idempotent: it skips if the `zimstat` organisation already exists.
