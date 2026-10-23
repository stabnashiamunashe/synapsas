# ZimStat Approvals User Manual

Version 2.0 · Prepared by Munashe Nzira

## 1. Introduction

ZimStat Approvals is the Agency's system for internal approvals and service requests. It replaces the paper forms for travelling and subsistence (T&S) advances and expense claims, applications for leave and annual leave (off days), and internal memos, and it adds a **service desk** for tickets, complaints and public data requests, reachable from the web portal and from WhatsApp.

This manual covers the whole product as deployed for the Zimbabwe National Statistics Agency. Screenshots were taken from the demonstration data; your names, sections and reference numbers will differ.

### Who does what

| Role | Typical person | Can do |
|---|---|---|
| Officer (Member) | Statistical officers, enumerators, clerks | Raise requests, act on approvals routed to them, handle service desk cases assigned to them, set out-of-office |
| Manager | Heads of section, supervisors / team leaders, accountant, internal auditor | Everything an officer can, plus act for their section: see the section's requests and cases, reassign cases, reports |
| Administrator | Director General, directors | Everything a manager can, plus design workflows, manage people and sections, categories and SLAs, settings, audit log |
| Owner | ICT systems administrator | Everything, including branding, API keys, WhatsApp and portal settings |

### How a request moves

A request starts as a **draft**, becomes **pending** when submitted, and visits each approval level in the order the form prescribes (for example Head of Section, then Finance, then the Director General). At every level the approver can approve, return it for changes, delegate it, or reject it. When the last level approves the request is **approved**. A return sends it back to the officer, or to an earlier level when the workflow says so.

### How a case moves

A service desk **case** (a ticket, complaint or data request) has its own lifecycle: new, triaged, assigned, in progress, on hold, resolved, closed, reopened, rejected. Cases are assigned automatically to the least-busy officer in the responsible section and carry a service target (SLA) in hours.

## 2. Getting started

### Signing in

Open the system address and sign in with your Agency email and password. Accounts are created by the ICT administrator; there is no self-registration. If two-factor authentication is on for your account, a second screen asks for the 6-digit code from your authenticator app or a backup code.

![Sign-in page](images/01-login.png)

Forgot your password? Click **Forgot password?**, enter your email and follow the link that is sent to you. The link works once and expires after one hour. After five wrong passwords the account is locked for 15 minutes; an administrator can unlock it sooner from People.

Passwords need at least 12 characters with upper and lower case letters and a number, and must not be a commonly used or previously breached password.

### Finding your way around

![The dashboard](images/04-dashboard.png)

- **Home** shows what is waiting on you, your open requests, recent activity and quick actions.
- The **sidebar** is grouped: Work (Home, Inbox, Requests, Reports, Activity), **Service desk** (Cases, Log a case, Categories & SLAs), Workflows (Projects & surveys, Workflow designs, New request, Out of office) and Organisation (People, Sections & divisions, Audit log, Settings). What you see depends on your role.
- The red badge next to **Inbox** is the number of approvals waiting on you.
- **Search** (or Ctrl K) finds a request by reference, title or requester. The **bell** shows unread notifications. The **avatar menu** opens your profile, security settings and sign out.

On a phone the sidebar collapses into a menu button. Tables scroll sideways and forms stack into one column; approving from the inbox works the same way.

![Mobile navigation](images/50-mobile-nav.png)

## 3. Raising a request

### Step 1: choose a form

Click **New request**. Pick the form that matches what you need; each card shows the approval route it will follow.

![Choosing a form](images/05-new-request-pick.png)

| Form | Prefix | Route |
|---|---|---|
| T&S Advance Application | TSA | Head of Section (recommend) → Finance Section (certify advance account) → Director General or Director Finance (approve) → Finance (disburse) |
| T&S Expense Claim | TSC | Supervisor / Team Leader (certify) → Accounts (checked, not previously paid) → Accountant or Director Finance (pass for payment) → Internal Audit (examine) |
| Application for Leave | LV | Supervisor (recommend) → Head of Section (approve) → Registry / HR (record and file) |
| Application for Annual Leave (off days) | AL | Supervisor (recommend) → Head of Office (approve) → Registry / Admin (record) |
| Internal memo | MEMO | Head of Section, then the Director General when marked for the Directorate |

### Step 2: fill in the form

The form mirrors the paper version. Fields marked with a red asterisk are required.

![T&S advance application](images/06-new-request-form.png)

- **Project / survey**: T&S advances and claims must be charged to a project (for example ZDHS, MICS or Treasury operations) so costs roll up per survey and funder.
- **Tables**: the allowance breakdown and the daily itinerary are line-item tables. Click **Add row**, fill the cells, and totals calculate automatically.
- **Declarations**: the undertakings printed on the paper forms (clearing an advance within 10 days, certifying a claim is true) are mandatory tick boxes.
- **Attachments**: receipts, tickets and medical certificates are attached to the request and travel with it through every level. Expense claims require at least one attachment.
- On leave applications the **annual leave balance** panel shows days allocated, taken, pending and remaining, and warns when a request exceeds the balance.

![Leave balance on a leave request](images/12-leave-balance.png)

### Step 3: save or submit

**Save as draft** keeps the request private to you. **Submit** starts the route: the request gets a reference (for example TSA-2026-0001), the first approver is notified, and the form is locked unless it is returned to you. A returned request reappears under Requests with an amber Returned pill and the approver's comment; edit and **Resubmit**. You can **withdraw** a pending request from its page.

## 4. Approving

Everything waiting on your decision is in **Inbox**: reference, title, requester, form, amount, how long it has waited and the level you are acting at. Overdue items are flagged in red.

![The inbox](images/07-inbox.png)

You are in someone's inbox when the current level names you, names your role, names your section (any officer in the section may act, for example Finance Section certification or Registry filing), or asks for the requester's supervisor or section head and that is you. Items delegated to you while a colleague is out of office are marked **On behalf of**.

![A request awaiting a decision](images/08-request-decision.png)

The request page shows the route diagram (green done, highlighted current, grey to come), the details as submitted, attachments, the timeline of every action, and comments.

![Confirming an approval](images/09-approve-modal.png)

| Action | What happens |
|---|---|
| **Approve** | Your decision is recorded; the request moves to the next level, or becomes Approved after the last one |
| **Reject** | The request ends as Rejected; a reason is required |
| **Return for changes** | Goes back to the officer, or to the earlier level the form prescribes (for example Finance returns a T&S advance to the Head of Section); when resubmitted it comes back through you |
| **Delegate** | Hand this one decision to a named colleague |

Some levels require a comment, for example Finance must state the officer's advance account balance when certifying a T&S advance. Decisions are final and are written to the audit log with your name, time and IP address.

![An approved T&S advance](images/11-request-approved.png)

### Escalation

Each level carries a service target in hours. When exceeded the approver is reminded, the item turns red, and the request is escalated to the person configured for that level. Nothing is approved automatically.

## 5. Tracking requests

**Requests** lists what you raised; managers see their section and administrators the whole Agency. Filter by status, form, project, requester, section or date; search by reference or title; export to CSV.

![The requests list](images/10-requests-list.png)

| Pill | Meaning |
|---|---|
| Draft | Saved, not submitted, visible only to you |
| Pending | In the route; the column shows the level it is waiting at |
| Returned | Sent back for changes; action is needed from the officer |
| Approved | Every level has approved |
| Rejected | An approver declined it |
| Withdrawn | The officer cancelled it |

## 6. Projects and surveys

Projects group requests and cases from any form and show what they cost together: a survey (ZDHS, MICS, census), a funder or a cost centre.

![Projects and surveys](images/13-projects.png)

Administrators create a project with a code, name, budget, owner and dates. Officers pick the project on the form; the request's cost (the allowance total of an advance, the itinerary total of a claim) is counted against it once approved. The project page shows approved and pending spend, spend by month, by form, the linked requests, and a CSV export.

![Project detail](images/14-project-detail.png)

## 7. Service desk: cases and tickets

The service desk handles anything that is not a form: ICT support, system access, facilities, finance queries, complaints about field work, and data requests from the public.

### The board

![The service desk board](images/20-cases-board.png)

**Cases** opens the board: one column per status, a card per case with a colour strip for status, a priority dot, the category, the section and the assignee. Drag a card to another column to change its status; officers follow the normal order (for example assigned → in progress → resolved) while administrators may move a card anywhere. Every move is recorded in the case timeline, and a reason can be made mandatory in settings.

The cards at the top show open cases, the resolution rate, the average time to resolve and the number of SLA breaches. The filter bar narrows by section, category, assignee, priority, "SLA breached" and "My cases"; **Views** saves a set of filters for next time. The **Table** view shows the same cases as a sortable, paginated grid.

![Table view](images/21-cases-table.png)

### Working a case

Click a card to open the case panel.

![A case](images/22-case-drawer.png)

- **Status**, **priority** and **assignee** are changed from the drop-downs at the top. Reassigning is limited to managers and administrators.
- **Activity** shows the timeline and the conversation. A note is **internal** (staff only) by default; switch **Public** to send an update to the reporter by email and WhatsApp and to show it on the tracking page.
- **Details** holds the section, category, project, SLA target, the reporter's contact details, location and office.
- **Files** lists attachments; each can be marked public (shown on the tracking page) or staff-only.
- **Duplicate of…** links the case to an earlier one, rejects it and tells the reporter which case is being handled.

If two people edit the same case at once, the second save is refused with a message to refresh; nothing is overwritten silently.

### Logging a case yourself

Use **Log a case** for phone calls, walk-ins, emails or something you noticed. Choosing a category sets the section, the service target and the default priority. While you type, similar recent cases are suggested so duplicates are avoided.

![Logging a case](images/23-case-new.png)

### How cases are assigned

A new case goes to the least-busy active officer in the responsible section. Officers on an active out-of-office delegation are skipped in favour of their delegate. If the section has nobody available, the case goes to the section's default assignee, then to the section head. When a staff member is deactivated, their open cases are reassigned automatically. Administrators can instead require the section head to triage every case first (Settings, Service desk & portal).

### Service targets (SLA)

Each category carries a target in hours. The assignee is warned before the target (24 hours by default) and the section head is notified when it is breached; both appear in the timeline. Reopening a case restarts the clock.

### Categories and SLAs

Administrators maintain categories under **Categories & SLAs**: the section that handles them, the target in hours, the default priority, and whether the public may choose the category on the portal and WhatsApp.

![Categories and SLAs](images/24-case-categories.png)

## 8. Public portal and WhatsApp

### Reporting on the website

Members of the public, researchers and other agencies can log a request without an account at **/report**. They choose a category, describe the request, optionally share a location and photos, and give a phone number or email. They receive a reference number immediately and an email with every public update.

![Public report form](images/02-report.png)

### Tracking

At **/track** anyone with a reference number can see the status, the timeline, public updates and public files, and can rate the service once the case is resolved. Personal details are never shown there.

![Public tracking page](images/03-track.png)

### WhatsApp

When the ICT administrator has connected the Agency's WhatsApp Business number, the public can report and track on WhatsApp using buttons and menus; only the description of the issue is typed. Reporters receive the reference and status updates as WhatsApp messages. Cases logged this way appear on the board with the source WhatsApp. Settings, WhatsApp shows the connection status and includes a sandbox where staff can try the conversation without a WhatsApp account.

![WhatsApp settings and sandbox](images/43-settings-whatsapp.png)

## 9. Designing workflows

Administrators maintain the forms under **Workflow designs**. Each design has its fields, its approval levels and its rules. Editing a design never changes requests already in flight; they keep the version they were submitted with.

![Workflow designs](images/15-workflows.png)

**Quick create** builds a workflow by naming its stages and choosing who signs at each. The full builder has four tabs.

![The Fields tab](images/16-builder-fields.png)

- **Fields**: text, numbers, currency, dates, selects, person and section pickers, check boxes, files and line-item tables with computed columns.
- **Canvas**: the route drawn as a diagram. Click a level to set who approves (section head, supervisor, any officer in a named section, named people, or a person chosen on the form), Any or All mode, the SLA and escalation, a condition (for example only when the total exceeds a threshold), and where a return goes.

![The canvas](images/17-builder-canvas.png)

![Level settings](images/18-level-settings.png)

- **Rules**: reference prefix, whether officers may withdraw, delegation, the cost field used for projects, whether a project is required, attachments.
- **Preview**: the form as an officer will see it.

## 10. People and sections

![People](images/30-people.png)

**People** lists every account with role, section, supervisor and status. Administrators invite colleagues by email (an invitation link valid for seven days), create accounts with a temporary password that must be changed at first sign-in, change roles and sections, deactivate accounts (their open cases are reassigned), unlock accounts and reset two-factor authentication.

The **supervisor** set on a person is who "Supervisor" levels route to; the **head** set on a section is who "Head of Section" levels route to.

![Sections and divisions](images/31-sections.png)

**Sections & divisions** holds the Agency's structure: each section has a code, a head and, for the service desk, an optional default assignee.

## 11. Notifications, activity and out of office

![Notifications](images/32-notifications.png)

The bell shows unread notifications; **Activity** lists them all. You are notified when something waits on you, when your request or case changes, when someone comments, and when an SLA is at risk. The same events are sent by email according to your preferences under Profile, Notifications (per event or as a daily or weekly digest). Security alerts are always emailed.

![Out of office](images/33-out-of-office.png)

Going on leave? Set an **out-of-office** delegate with start and end dates. Approvals routed to you also reach the delegate, marked On behalf of, and new service desk cases are assigned to the delegate instead of you.

## 12. Reports and the audit log

![Reports](images/34-reports.png)

**Reports** shows volumes, approval rates, cycle times, the slowest levels and spend by project. The service desk board carries its own figures: open cases, resolution rate, average resolution time and SLA breaches, with breakdowns by section, priority and source available through the API for dashboards.

![Audit log](images/35-audit.png)

The **audit log** is an unalterable record of everything: sign-ins, password and two-factor changes, every request and case action, changes to workflows, people, sections, settings and API keys, each with who, when, IP address and browser. Filter and export it for auditors.

## 13. Settings (administrators)

![Branding](images/40-settings-branding.png)

- **Branding**: product name, logo, colour and footer.
- **Organisation & security**: name, currency, timezone, password and session rules, lockout threshold, two-factor requirement for administrators, and the **annual leave entitlement** (12 days by default) used for leave balances.

![Organisation settings](images/41-settings-organisation.png)

- **Service desk & portal**: reference prefix, automatic assignment, triage-first, mandatory reasons, SLA warning window, board columns, and the public portal's heading, introduction, contact details and announcement banner.

![Service desk settings](images/42-settings-service-desk.png)

- **WhatsApp**: connection status, webhook address for Meta, template names, behaviour switches, test sends, the sandbox and the message log.
- **API & webhooks**: keys for integrations (for example a finance system pulling approved claims) and signed webhooks fired on request events.

![API and webhooks](images/44-settings-api.png)

## 14. Your account

Open your profile from the avatar menu. Update your name, job title, phone and avatar. Under **Security** change your password, enable two-factor authentication with an authenticator app (you receive ten single-use backup codes), and sign out of all other devices. Under **Notifications** choose which events reach you in the app and by email.

![Security settings](images/45-profile-security.png)

## 15. Troubleshooting

**I cannot sign in.** After five wrong attempts the account locks for 15 minutes; an administrator can unlock it from People. Use Forgot password? if needed.

**I lost my phone and cannot get a two-factor code.** Use a backup code. If you have none, an administrator can reset two-factor from People.

**A request is not in my inbox but someone says it is waiting on me.** Check the route on the request page. Your supervisor or section head may not be set correctly in People, or the level may name a section you are not in.

**A case was assigned to the wrong person.** Managers and administrators can reassign from the case panel; the change is recorded in the timeline. Check the category's section under Categories & SLAs.

**The leave balance looks wrong.** Only approved annual and vacation leave for the current year counts against the entitlement; sick, special and unpaid leave do not. The entitlement is set under Settings, Organisation.

**Reporters are not receiving emails or WhatsApp messages.** Email needs the SMTP settings on the server and WhatsApp needs the Meta connection; both are shown as configured or not under Settings. Messages that could not be delivered are listed in the outbox and WhatsApp log with the reason.

### Glossary

| Term | Meaning |
|---|---|
| Form / workflow design | The fields, route and rules a request follows |
| Level | One signature step in the route |
| Section approver | A level any officer in a named section may act on (Finance, Registry, Internal Audit) |
| Case | A service desk ticket, complaint or public request |
| SLA | Service target in hours for a level or a case category |
| Project | A survey, funder or cost centre that requests and cases are charged to |
| Delegation | Letting a colleague act for you, for one decision or for a period |
| Audit log | The unalterable record of every action |

---

*ZimStat Approvals user manual. Screenshots come from demonstration data.*
