# Synapsas User Manual

6 October 2026 · Munashe Nzira

## 1. Introduction

Synapsas routes memos, requisitions, travel claims, document sign-offs and any other internal request through a configurable chain of approval levels, then keeps the full record. You design the form and the levels once; staff raise requests from any device; approvers decide in one click; finance sees the cost of every request rolled up by project.

This manual covers the whole product as it stands on 6 October 2026. Screenshots come from the demo workspace "Acme Approvals"; your workspace will carry your own name, colours and logo.

### Who does what

| Role | Typical person | Can do |
| --- | --- | --- |
| Member | Any staff member | Raise requests, track their own, act on approvals routed to them, set out-of-office |
| Manager | Line managers, department heads, finance | Everything a member can, plus see all requests, reports and projects, create projects |
| Admin | Operations or IT administrator | Everything a manager can, plus design workflows, manage people and departments, settings, audit log |
| Owner | The person who created the workspace | Everything, plus plan and billing, granting ownership |

### How a request moves

A request starts as a **draft**, becomes **pending review** when submitted, and visits each approval level in order. At every level the approver can approve, return it for changes, delegate it, or reject it. When the last level approves, the request is **approved**; a rejection ends it; a return sends it back to the requester (or, if the workflow says so, back to an earlier level). Levels can be conditional, so an executive step might only run when the amount is above a threshold.

### Key terms

- **Workflow (design)**: the template for one kind of request: its form fields and its approval levels.
- **Level**: one approval stage. It names who approves (named people, a role, the requester's manager, the department head, or someone chosen on the form), how many must agree, and the time allowed.
- **SLA**: the hours an approver has before the step is flagged overdue and escalated.
- **Project**: a bucket that requests can be attached to so their costs are added up against a budget.
- **Cost field**: the form value a workflow treats as the request's cost (usually a line-item total).

## 2. Getting started

A workspace takes about two minutes to create and comes with a 14-day Business trial, no card needed.

### Creating a workspace

1. Open the Synapsas website and click **Start free** (or **Create your workspace**).
2. Enter the organisation name; the workspace URL is suggested from it (for example `acme`).
3. Enter your name, work email and a password. Passwords need at least 10 characters with upper and lower case letters and a number.
4. Click **Create workspace**. You become the workspace owner and land in the onboarding wizard.

![The public site](blob/6e594d4d-600e)

![Create your workspace](blob/7dfad85d-f27f)

### Signing in

Use your workspace's own sign-in page, `/login?org=<workspace>`, so you see your organisation's branding. Enter your email and password. If two-factor authentication is on for your account, a second screen asks for the 6-digit code from your authenticator app, or one of your backup codes.

![Sign-in page with tenant branding](blob/2a32c278-236c)

Forgot your password? Click **Forgot password?**, enter your email, and follow the link that is sent to you. The link works once and expires after one hour. If you sign in with a temporary password set by an administrator, you are asked to choose your own before you can continue.

After five wrong passwords the account is locked for 15 minutes. An administrator can unlock it sooner from **People**.

### The onboarding wizard

The owner is taken through four short steps the first time they sign in:

1. **Organisation**: name, currency, timezone and the billing email that receives invoices.
2. **Team**: email addresses and roles for the first people to invite. Each gets an invitation link valid for seven days.
3. **Workflows**: tick the ready-made workflows to start with (purchase requisitions, memos, document approvals, leave, expense claims). Each becomes fully editable afterwards.
4. **Plan**: a summary of the trial and the plans available.

![Onboarding wizard](blob/0c586c48-27d9)

Everything chosen here can be changed later under Settings, People and Workflow designs.

## 3. Finding your way around

![The dashboard](blob/27921eb3-807a)

### The dashboard

The dashboard is the first page after sign-in. It shows:

- **Stat cards** for the number of requests waiting on you, requests you have raised that are still open, approved this month, and average time to decision.
- **Waiting on you**: the requests you can act on right now, with the same Approve and Reject buttons found on the request page.
- **Recent activity**: the latest events in the workspace that involve you.
- **Quick actions**: New request, and for administrators, Quick create workflow and Invite people.

### The sidebar

The left sidebar is grouped by task. What you see depends on your role.

| Group | Pages | Who sees it |
|---|---|---|
| Work | Dashboard, Inbox, My requests, Projects | Everyone |
| Design | Workflow designs | Admins and owners |
| People | People, Departments | Admins and owners |
| Insight | Reports, Audit log | Admins and owners |
| Settings | Branding, Organisation, Billing, API & webhooks, Out of office | Owners (Out of office: everyone) |

The red badge next to **Inbox** is the number of approvals waiting on you.

### The header

- **Search** (or press `Ctrl K` / `⌘ K`): find a request by reference number, title or requester and jump straight to it.
- **Bell**: unread notifications. Click one to open the related request.
- **Avatar menu**: your profile, security settings and sign out.
- A **billing banner** appears above the page when the trial is ending or an invoice is overdue. Owners can click through to Billing from it.

### On a phone or tablet

The sidebar collapses into a menu button at the top left. Tables scroll sideways and forms stack into one column. Everything you can do on a desktop you can do on a phone, including approving from the inbox.

![Mobile navigation](blob/46263d21-0a0b)

## 4. Raising a request

Anyone in the workspace can raise a request. The example below follows a travel and subsistence claim, but the steps are the same for memos, requisitions, document approvals and any other workflow your administrators have designed.

### Step 1: choose a workflow

Click **New request** in the sidebar or on the dashboard. Pick the workflow that matches what you need. Each card shows the workflow name, a short description, and the approval route it will follow.

![Choosing a workflow](blob/0fe6164c-1e09)

### Step 2: fill in the form

The form is built from the fields the workflow designer chose. Fields marked with a red asterisk are required.

![A travel and subsistence form with a line-item table](blob/e2efb59f-1e2b)

- **Project**: if the workflow is linked to projects, choose the project this request belongs to. Its cost will be counted against that project. A workflow can make this mandatory.
- **Dates and amounts**: date pickers and number fields validate as you type.
- **Tables**: some workflows contain line-item tables (for example per-diem days, or items on a requisition). Click **Add row** to add a line, fill in the cells, and use the bin icon to remove a line. Calculated columns and totals update automatically.
- **Attachments**: drag files onto the attachment area or click to browse. Quotes, receipts and supporting documents stay with the request through every approval step.

On the right (or below, on a phone) you can see the approval route the request will follow and who will be asked to approve at each level.

### Step 3: save or submit

- **Save as draft** keeps the request private to you. Drafts appear under **My requests** with a grey Draft pill and can be edited or deleted at any time.
- **Submit** starts the workflow. The request gets a reference number (for example `TS-2026-0001`), the first level of approvers is notified, and you can no longer edit the form unless an approver returns it to you.

### After submitting

You receive a notification and an email each time the request moves. If an approver **returns** the request for changes, it reappears in **My requests** with an amber Returned pill and the approver's comment. Edit the form and click **Resubmit**; the workflow restarts from the level the approver chose.

You can **withdraw** a pending request from its page if it is no longer needed. Withdrawn requests stay in the history but need no further action.

## 5. Approving requests

### The inbox

Everything waiting on your decision is listed in **Inbox**. Each card shows the reference, title, requester, workflow, amount, how long it has been waiting, and the level you are approving at. Overdue items (past the level's service-level target) are flagged in red.

![The approvals inbox](blob/240dacfd-a721)

You are in someone's inbox when the current level names you directly, names your role, names your department as its head, or asks for the requester's line manager and that is you. If a colleague has set you as their out-of-office delegate, their items appear in your inbox too, marked **On behalf of**.

### Reviewing a request

Open a request to see the full picture before deciding.

![A request awaiting the line manager's decision](blob/396d8985-59f4)

- **Route diagram** at the top shows every level, who approves at each, and where the request is now. Green is done, the highlighted box is the current level, grey is still to come. A dashed amber arrow shows where a return-for-changes would send the request.
- **Details** shows every field as submitted, including line-item tables and totals.
- **Attachments** can be downloaded individually.
- **Timeline** lists every event in order: submission, each approval or return with its comment, delegations and escalations.
- **Comments** lets you ask the requester or other approvers a question without making a decision yet. Everyone on the request is notified.

### Making a decision

The decision bar sits at the top right of the request (and at the bottom on a phone).

![Confirming an approval](blob/6edfdfa7-8b6a)

| Action | What happens |
|---|---|
| **Approve** | Your approval is recorded. If the level needs everyone (ALL) the request waits for the rest; if it needs anyone (ANY) it moves straight to the next level. After the final level the request is Approved. |
| **Reject** | The request ends as Rejected. A reason is required and is sent to the requester. |
| **Return for changes** | The request goes back to the requester (or to the earlier level the workflow designer chose) with your comment. When resubmitted it re-enters the route and comes back through you. |
| **Delegate** | Hand this one decision to a named colleague. They act in your place for this request only. |

A comment is optional on approval and required on rejection or return. Decisions are final and are written to the audit log with your name, the time and your IP address.

### What the requester sees

Once the last level approves, the request shows a green Approved pill, every level in the diagram turns green, and the requester is notified. If the request belongs to a project, its cost is now counted in that project's totals.

![An approved request](blob/dfa5ebbd-f4cd)

### Escalation

Each level can carry a service-level target in hours. When it is exceeded the approver is reminded, the item turns red in the inbox, and if the designer configured an escalation target the request is also routed to that person or role. Nothing is approved automatically; a person always makes the decision.

## 6. Tracking requests

**My requests** lists everything you have raised. Administrators and owners can switch the scope to **All requests** to see the whole workspace.

![The requests list](blob/7517967a-49d8)

### Filtering

Use the filter bar to narrow the list by status, workflow, project, requester, department or date range. Type in the search box to match a reference number or title. Filters are kept in the page address, so you can bookmark a view such as "all pending requisitions this month" or share the link with a colleague.

### Status pills

| Pill | Meaning |
|---|---|
| Draft (grey) | Saved but not submitted. Only you can see it. |
| Pending (blue) | In the approval route. The column shows which level it is waiting at. |
| Returned (amber) | Sent back for changes. Action is needed from the requester. |
| Approved (green) | Every level has approved. |
| Rejected (red) | An approver declined it. |
| Withdrawn (grey) | The requester cancelled it. |

### Exporting

Click **Export CSV** to download the current filtered list with all standard columns plus the cost amount and project code. The export respects the filters you have applied.

## 7. Projects and cost tracking

Projects let you group requests from any workflow and see what they cost together. A field trip, a construction phase, a marketing campaign or a cost centre can each be a project.

![The projects list](blob/81556257-5cec)

### Creating a project

Administrators and owners click **New project** on the Projects page and fill in:

- **Code**: a short unique identifier such as `FIELD-OPS`. It appears on requests and in exports.
- **Name** and **description**.
- **Budget** and currency (optional). When set, the project page shows how much of the budget has been committed.
- **Owner**: the person accountable for the project.
- **Start and end dates** (optional).

Projects are **Active** by default. Archive a project when it closes; archived projects keep their history but can no longer be chosen on new requests.

### Linking requests to a project

A request is linked when the requester picks a project on the form. Workflow designers decide, per workflow, whether the project field is shown and whether it is required (see **Rules** in section 8). Administrators can change the project on an existing request from the request page.

### How the cost is worked out

Each workflow nominates one field as its **cost field**: a plain amount, or the total of a line-item table. When a request is submitted the value is copied to the request as its cost. If the designer leaves the cost field on **Auto-detect**, the first field whose name contains "total", "amount" or "cost" is used.

### The project page

![Project detail with cost breakdown](blob/2e3966e4-fdb9)

- **Stat cards**: approved spend, pending spend (submitted but not yet approved), number of requests, and budget remaining.
- **Spend by month**: a bar for each month showing approved and pending amounts.
- **By workflow**: how much came through each workflow, so you can see for example that travel is 40 percent of the project's cost.
- **Requests**: every linked request with its status and amount. Click through to the request.
- **Export CSV** downloads the request list for the project, ready for a finance system or spreadsheet.

Only approved requests count as committed spend. Rejected and withdrawn requests are listed but excluded from totals.

## 8. Designing workflows

This section is for administrators and owners. A workflow design (also called a template) defines the form people fill in, the route the request takes, and the rules that apply.

![Workflow designs](blob/4dcbbe3c-b261)

The Workflow designs page lists every design with its prefix, number of levels, how many requests have used it, and whether it is active. Inactive designs cannot be used for new requests but existing requests keep running.

### Quick create: just add stages

The fastest way to build a workflow is **Quick create**.

![Quick create](blob/21351d6d-6ec8)

1. Give the workflow a name and a reference prefix (for example `TS` produces `TS-2026-0001`).
2. Optionally start from a preset: purchase requisition, memo, document approval, leave, expense claim or travel.
3. Add stages. Each stage is one approval level. Type a name and choose who approves: the requester's line manager, their department head, a role, a department's head, or named people.
4. Drag stages to reorder them. Click **Create**.

The workflow is created with a sensible default form and is ready to use. Open it afterwards to refine fields and rules.

### The workflow builder

Opening a design shows the builder with four tabs.

#### Fields

![The Fields tab](blob/7398dbc7-2e4d)

Add the fields that make up the form. Each field has a label, a key, a type and validation options.

| Type | Use it for |
|---|---|
| Text, Long text | Titles, justifications, descriptions |
| Number, Currency | Quantities and amounts |
| Date, Date range | Travel dates, deadlines |
| Select, Multi-select | Fixed choices such as cost centre or priority |
| User, Department | Picking a colleague or a department |
| Checkbox | Yes/no confirmations |
| File | Supporting documents |
| Table | Line items with their own columns, for example days × rate, or item, quantity and unit price. Columns can be calculated. |

Mark a field **Required**, give it a placeholder or help text, and set minimum and maximum values. Drag the handle to reorder fields.

#### Canvas

![The Canvas tab](blob/d1e5cdb8-cc4b)

The canvas draws the route as a diagram you can edit. Click **Add level** to append a stage, drag boxes to rearrange them, and click a box to open its settings.

![Level settings](blob/3778065a-2f75)

For each level you set:

- **Name** shown to approvers and in the timeline.
- **Approver**: a named user or users, a role (Owner, Admin, Manager), the requester's line manager, the requester's department head, or the user or department head chosen in a form field.
- **Mode**: **Any** (one approval is enough) or **All** (everyone named must approve).
- **SLA hours** and an **escalation** target.
- **Condition**: only run this level when a field meets a rule, for example *Total greater than 5,000*. Levels whose condition is not met are skipped and shown greyed out.
- **Return to**: where a Return for changes from this level sends the request. The default is back to the requester. Choosing an earlier level creates a loop-back, drawn as a dashed amber arrow. For example a department head can send a travel claim back to the line manager rather than to the traveller.

#### Rules

![The Rules tab](blob/bc3496a6-6549)

- **Allow requester to withdraw** while pending.
- **Allow approvers to delegate** a single decision.
- **Reference prefix** and numbering.
- **Cost field**: which field represents the request's cost for project aggregation, or Auto-detect.
- **Project**: hide, show as optional, or require a project on every request.
- **Attachments**: whether files are required.

#### Preview

![The Preview tab](blob/d8684aa1-2bf0)

Preview renders the form exactly as a requester will see it, alongside the route diagram. Use it to check field order, labels and table layouts before publishing.

### Publishing and versions

Click **Save** to store changes. Requests that are already in flight keep the version of the design they were submitted with, so editing a workflow never changes the route of an existing request. Toggle **Active** off to retire a design.

## 9. People and departments

### Roles

| Role | Can do |
|---|---|
| **Member** | Raise requests, approve when named, comment, manage own profile |
| **Manager** | Everything a member can, plus act as line manager for their reports and see their team's requests |
| **Admin** | Everything a manager can, plus design workflows, manage people, departments and projects, view reports and audit log |
| **Owner** | Everything, including branding, organisation settings, billing and API keys. There is always at least one owner. |

### People

![People](blob/5677e195-12f6)

The People page lists every account with its role, department, line manager and status.

- **Invite**: enter an email, choose a role, department and line manager. An invitation email with a link valid for seven days is sent. Pending invitations are shown with a **Resend** option.
- **Edit**: change a person's role, department or manager. Changes apply immediately to new requests; requests already in flight keep their original approvers.
- **Deactivate**: the person can no longer sign in, and any approvals waiting on them are flagged so an administrator can reassign them. History is kept.
- **Unlock**: clears a lockout caused by too many wrong passwords.
- **Reset password**: issues a temporary password that the person must change at next sign-in.
- **Reset two-factor**: removes an authenticator the person no longer has access to.

Line managers matter: the **Requester's manager** approver type routes to whoever is set here.

### Departments

![Departments](blob/7c9bc8fb-8064)

Create a department, give it a code and name, and choose its **head**. The **Department head** approver type routes to this person. Departments can be nested under a parent for reporting, and each shows how many people belong to it.

## 10. Notifications, activity and out of office

### Notifications

![Notifications](blob/f3ae0345-5356)

The bell in the header shows unread notifications. The Notifications page lists them all, newest first, and lets you mark everything read. You are notified when:

- a request is waiting on your decision, or has been escalated to you;
- a request you raised is approved, rejected, returned or commented on;
- someone delegates a decision to you, or sets you as their out-of-office delegate;
- an invitation is accepted or an account you manage is locked.

The same events are sent by email. Choose which ones under **Profile > Notifications** (section 13).

### Out of office

![Out of office delegation](blob/2584a7f0-aa72)

Going on leave? Set a delegate so approvals do not stall.

1. Open **Settings > Out of office** (everyone can do this for themselves).
2. Choose the colleague who will act for you and the start and end dates.
3. Optionally limit the delegation to certain workflows.

While the delegation is active, anything routed to you also appears in the delegate's inbox marked **On behalf of**. Their decisions are recorded under their name with a note that they acted for you. You can still act yourself. Administrators can set delegations for other people.

## 11. Reports and the audit log

### Reports

![Reports](blob/0d469682-9fb4)

Reports give administrators a view of how approvals are flowing.

- **Volume**: requests submitted, approved and rejected per month.
- **Cycle time**: average and median hours from submission to final decision, overall and per workflow.
- **By workflow** and **by department**: counts and totals.
- **Bottlenecks**: the levels and approvers with the longest waiting times and the most overdue items.
- **Spend**: approved cost per project and per workflow for the period.

Set the date range at the top. Every table can be exported to CSV.

### Audit log

![Audit log](blob/60707356-fc69)

The audit log is an immutable record of everything that happens in the workspace: sign-ins and failed sign-ins, password and two-factor changes, every request event, every change to a workflow design, people, departments, projects, settings, API keys and billing. Each entry records who, what, when, the IP address and browser.

Filter by person, action type, object or date range, and export to CSV for auditors. Entries cannot be edited or deleted by anyone, including owners.

## 12. Workspace settings (owners)

### Branding

![Branding](blob/7b144b87-4fb4)

Make the workspace yours. Upload a logo (shown in the sidebar, on the sign-in page and in emails), choose the brand colour used for buttons and highlights, and set the product name your people see. Changes apply instantly to everyone.

### Organisation

![Organisation settings](blob/55971429-451e)

Set the organisation name, workspace URL, default currency, timezone and date format, and the billing email that receives invoices. You can also set a password policy stricter than the default and require two-factor authentication for all administrators.

### Billing

![Billing](blob/26e74863-ac9b)

The Billing page shows the current plan, the number of active users, the next invoice date and the payment method.

**Plans**

| Plan | Includes |
|---|---|
| Starter | Up to 10 users, 3 workflow designs, core approvals |
| Business | Unlimited workflows, projects, reports, delegation, API access |
| Enterprise | Everything in Business plus SSO, custom retention and priority support |

**Lifecycle**

1. **Trial**: 14 days of Business, no card needed. A banner counts down the last five days.
2. **Active**: a subscription is in place and invoices are paid on time.
3. **Past due**: an invoice is unpaid after its due date. Everyone can still sign in and approve, but a banner asks the owner to settle the invoice.
4. **Locked**: after the grace period the workspace becomes read-only. Existing requests can be viewed and exported but nothing new can be raised or approved until payment is received. Nothing is deleted.

To subscribe, choose a plan and click **Subscribe**. Depending on how your Synapsas instance is configured you will pay by card through Stripe, by mobile money or card through Paynow, or by bank transfer against an invoice that the Synapsas team marks as paid. Invoices are listed with their status and can be downloaded.

### API and webhooks

![API and webhooks](blob/8fdea8ae-4dbd)

For integration with other systems.

- **API keys**: create a key with a name and scopes (read requests, create requests, manage people). The secret is shown once; store it safely. Revoke a key at any time.
- **Webhooks**: register an HTTPS URL to be called when a request is submitted, approved, rejected or returned. Each delivery is signed so your system can verify it came from Synapsas. Recent deliveries and their responses are listed for troubleshooting.

## 13. Your account

Open your profile from the avatar menu in the header.

### Profile

![Profile](blob/43b983db-4514)

Update your name, job title, phone number and avatar. Your email, department, role and line manager are set by an administrator; contact them to change these.

### Security

![Security settings](blob/c267a659-a012)

- **Change password**: enter your current password and a new one that meets the policy.
- **Two-factor authentication**: click **Enable**, scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or similar) and enter the 6-digit code to confirm. You are then given ten **backup codes**. Save them somewhere safe; each one can be used once if you lose your phone.
- **Sessions**: see where you are signed in and click **Sign out everywhere** to end every other session immediately.

Your workspace may require two-factor authentication for your role. If so you will be asked to set it up at your next sign-in.

### Notification preferences

![Notification preferences](blob/279faaf0-afd1)

Choose, for each kind of event, whether you want an in-app notification, an email, or both. A daily digest option bundles non-urgent emails into one message each morning. Approval requests waiting on you are always delivered in-app.

## 14. Platform console (Synapsas operators)

This section applies only to the team operating the Synapsas service, not to customer workspaces.

![Platform console](blob/5fd9fd11-2311)

The console lives at `/platform` and is protected by the platform admin key set in the server environment. After entering the key and clicking **Load workspaces** you can:

- see every workspace with its plan, billing status, user count and trial or renewal date;
- extend a trial, change a plan, or mark a manually paid invoice as settled;
- suspend or unlock a workspace;
- run the billing sweep that moves workspaces between active, past due and locked according to their invoices.

Every action here is written to the affected workspace's audit log as a platform action.

## 15. Troubleshooting and FAQ

**I can't sign in.** Check you are on your workspace's sign-in page (the organisation name should be shown). After five wrong attempts the account locks for 15 minutes; an administrator can unlock it from People. Use **Forgot password?** if needed.

**I lost my phone and can't get a two-factor code.** Use one of your backup codes. If you have none, an administrator can reset two-factor from People.

**A request isn't in my inbox but someone says it is waiting on me.** Check the route on the request page. The level may name a role you do not have, or your line manager or department head may not be set correctly in People. Administrators can fix the assignment and the request will reroute.

**I submitted to the wrong project.** Ask an administrator; they can change the project on the request page and totals will update.

**The cost on my project is zero.** The workflow may not have a cost field set, or it is set to a field that was left empty. Check the Rules tab of the workflow design.

**The workspace is read-only.** The subscription is past due or locked. The owner can settle the invoice under Settings > Billing; access returns immediately after payment is recorded.

**Can I edit a workflow while requests are using it?** Yes. In-flight requests keep the version they were submitted with. Only new requests use the new design.

**Can two people approve the same level?** Yes. Set the level's mode to **All** to require each named approver, or **Any** to accept the first.

### Glossary

| Term | Meaning |
|---|---|
| **Workflow design / template** | The form, route and rules a request follows |
| **Level / stage** | One approval step in the route |
| **Approver type** | How a level decides who approves: user, role, department head, requester's manager, or a field on the form |
| **Any / All** | Whether one approval or every approval is needed at a level |
| **SLA** | Service-level target in hours for a level |
| **Escalation** | Who is additionally notified or assigned when an SLA is exceeded |
| **Loop-back / Return to** | Sending a request back to an earlier level instead of the requester |
| **Delegation** | Letting a colleague decide in your place, for one request or for a period |
| **Project** | A grouping of requests for cost aggregation |
| **Cost field** | The form field whose value becomes the request's cost |
| **Audit log** | The immutable record of every action in the workspace |
| **Owner / Admin / Manager / Member** | The four roles, from most to least permission |

---

*Synapsas user manual. Screenshots were taken from a demonstration workspace; your branding, workflow names and people will differ.*