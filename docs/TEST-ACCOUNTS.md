# Synapsas test accounts

Loaded by the demo seed (`docker compose --profile seed run --rm seed`, or `npm run db:seed` locally).
Workspace: **Acme Limited**, slug `acme`.

Sign-in page: `https://synapsas.tech/login?org=acme` (locally `http://localhost:3000/login?org=acme`).

**Password for every account: `Password123!`**

| Email | Name | Role | Job title | Department | Reports to | Use it to test |
| --- | --- | --- | --- | --- | --- | --- |
| owner@acme.test | Olivia Owner | OWNER | Chief Executive | – | – | Everything: branding, organisation, billing, API keys, workflow designs, people. Final approver on document sign-off (ALL mode with Legal). Fallback approver on memos. |
| cfo@acme.test | Frank Finance | ADMIN | Chief Financial Officer | Finance (head) | Olivia Owner | CFO level on purchase requisitions when total ≥ $5,000. Head office approver on Travel & subsistence. |
| ops.head@acme.test | Hannah Head | MANAGER | Head of Operations | Operations (head) | Olivia Owner | Department-head level for Operations staff; escalation and fallback target for line-manager levels. |
| manager@acme.test | Mike Manager | MANAGER | Operations Manager | Operations | Hannah Head | Line manager of Sam Staff and Jane Junior: first level on most requests. Head of Sales department. |
| procurement@acme.test | Priya Procurement | MANAGER | Procurement Lead | Operations | Hannah Head | Procurement review level on purchase requisitions. |
| legal@acme.test | Lena Legal | MANAGER | Legal Counsel | Legal (head) | – | Legal & executive sign-off on Policy and Contract documents (ALL mode with Olivia). |
| member@acme.test | Sam Staff | MEMBER | Operations Officer | Operations | Mike Manager | Raising requests as an ordinary employee. |
| jane@acme.test | Jane Junior | MEMBER | Sales Executive | Sales | Mike Manager | Raising requests from a second department. |

## Suggested test flows

| Flow | Raise as | Then approve as |
| --- | --- | --- |
| Purchase requisition under $5,000 | member@acme.test | manager@acme.test → procurement@acme.test |
| Purchase requisition ≥ $5,000 | member@acme.test | manager@acme.test → procurement@acme.test → cfo@acme.test (comment required) |
| Internal memo (not confidential) | jane@acme.test | manager@acme.test |
| Internal memo (confidential) | jane@acme.test | manager@acme.test → ops.head@acme.test |
| Document approval, type Policy or Contract | member@acme.test (pick a reviewer and owning department on the form) | reviewer → department head → legal@acme.test **and** owner@acme.test |
| Travel & subsistence (if set up via `scripts/setup-travel.mjs`) | member@acme.test | manager@acme.test → ops.head@acme.test → cfo@acme.test |
| Return for changes / loop-back | any | approver clicks **Return for changes**; requester edits and resubmits |
| Out-of-office delegation | manager@acme.test sets a delegate under Settings → Out of office | delegate sees the item marked "On behalf of" |

## Platform console

`https://synapsas.tech/platform` — enter the value of `PLATFORM_ADMIN_KEY` from `.env` on the server (example file default: `change-me-platform-admin-key`; change it in production).

## Notes

- All seed passwords are identical and public. Deactivate or reset these accounts before real users join a production workspace, or run without the seed and register a fresh workspace at `/register`.
- Two-factor authentication is off for every seed account; enable it under Profile → Security to test the TOTP flow.
- The seed is idempotent: it skips if the `acme` workspace already exists.
