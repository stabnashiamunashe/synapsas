# Municipality of Chitungwiza demo accounts

Loaded by the seed (`docker compose --profile seed run --rm seed`, or `npm run db:seed` locally). All names are fictional.

Sign-in page: `https://<your-host>/login` (locally `http://localhost:3000/login`).

**Password for every account: `Password123!`**

| Email | Name | Role | Position | Department | Reports to |
| --- | --- | --- | --- | --- | --- |
| ict.admin@chitungwiza.co.zw | Tendai Moyo | OWNER | ICT Systems Administrator | ICT Unit | ICT Manager |
| secretary@chitungwiza.co.zw | Rufaro Chikwanha | ADMIN | Town Clerk | Town Clerk's Office | – |
| treasurer@chitungwiza.co.zw | Nyasha Dube | ADMIN | Treasurer (head of Finance) | Finance (Treasury) | Town Clerk |
| accountant@chitungwiza.co.zw | Farai Ncube | MANAGER | Accountant | Finance (Treasury) | Treasurer |
| cashier@chitungwiza.co.zw | Rudo Mutasa | MEMBER | Revenue Officer (cashier; receipts licence fees) | Finance (Treasury) | Accountant |
| admin.officer@chitungwiza.co.zw | Chipo Mlambo | MANAGER | Administration & HR Officer (head of Admin; transport) | Administration & HR | Town Clerk |
| registry@chitungwiza.co.zw | Blessing Sibanda | MEMBER | Registry Clerk | Administration & HR | Admin Officer |
| internal.audit@chitungwiza.co.zw | Tapiwa Gumbo | MANAGER | Internal Auditor | Internal Audit | Town Clerk |
| ict.head@chitungwiza.co.zw | Kudzai Mhlanga | MANAGER | ICT Manager | ICT Unit | Town Clerk |
| engineer@chitungwiza.co.zw | Tariro Chigumba | MANAGER | Director of Engineering & Works (approves building plans) | Engineering & Works | Town Clerk |
| works.supervisor@chitungwiza.co.zw | Munyaradzi Zvobgo | MANAGER | Works Supervisor | Engineering & Works | Director of Engineering |
| l.officer@chitungwiza.co.zw | Leonard Officer | MEMBER | ICT Technician | ICT Unit | ICT Manager |
| p.officer@chitungwiza.co.zw | Pamela Officer | MEMBER | Roads Foreman | Engineering & Works | Works Supervisor |
| **health.officer@chitungwiza.co.zw** | Tsitsi Marimo | MANAGER | Environmental Health Officer (head of Health, Housing & Community Services; **approves and issues licences**) | Health, Housing & Community Services | Town Clerk |
| **licensing@chitungwiza.co.zw** | Simbarashe Chawira | MEMBER | Licensing Officer (logs applications, checks documents, records fees) | Health, Housing & Community Services | Health Officer |
| **inspector@chitungwiza.co.zw** | Grace Mapfumo | MEMBER | Health Inspector (records inspection results) | Health, Housing & Community Services | Health Officer |

## Suggested demo walk-through

| Step | Sign in as | What to do | What you see |
| --- | --- | --- | --- |
| 1 | health.officer | Home | Dashboard in the council's green and gold; the **Licensing** strip shows applications awaiting action and licences expiring within 30 days. |
| 2 | licensing | Licensing → **New licence application** | Choose *Shop licence*; the fee, validity and document checklist come from the licence type. Log it; reference `LA-<year>-nnnn`. |
| 3 | licensing | Open the application | **Start review**, tick documents as they arrive (*Save checklist*), then **Schedule inspection** for Grace Mapfumo. |
| 4 | inspector | Licensing → *Mine* | **Record inspection result**: Passed / Passed with conditions / Failed. A failed inspection sends the application back for re-inspection or rejection. |
| 5 | health.officer | Open the application | **Approve** (optionally attach conditions). Status becomes *Approved · fee due*. |
| 6 | cashier | Open the application | **Record payment** with the receipt number. |
| 7 | health.officer | Open the application | **Issue licence**: number `CMC/SHP/<year>/nnnn`, validity dates. Click **Certificate** to print. |
| 8 | anyone | `/verify` (public, no sign-in) | Enter the licence number: shows *Valid* with holder, premises and expiry. |
| 9 | health.officer | Licensing → *Expiring* | `CMC/HWK/…/0203` is expired: **Renew** opens a linked renewal application with the applicant's details copied. |
| 10 | health.officer | Licensing → open `Gwaze Hardware` | A **suspended** licence with the reason on record; **Reinstate** or **Revoke** from *More*. |
| 11 | secretary (admin) | Licensing → **Licence types & fees** | Edit the fee schedule, validity, inspection requirement and required documents. |
| 12 | nobody (public) | `/apply` | Apply for a *Hawker / vendor permit* as a citizen: fee and required documents are shown, documents can be attached per requirement, a reference comes back. Then `/verify` → *Track my application* with the reference and phone number: status, next step, upload buttons for outstanding documents. |
| 13 | secretary (admin) | Settings → **WhatsApp channel** → Sandbox | Type **licence**: pick a licence from the list, answer name, trading name, premises, ward (type a number) and description, tap **Submit**. The reference and document list come back. Type **my licences** to see the status, fee due or licence number. Approving the application in the register produces the applicant notice in the message log. |
| 14 | secretary (admin) | Licensing → **Licence types, fees & forms** → *Shop licence* → **Application form** | The Shop Licence Act form transcribed from the paper form: numbered sections, dropdowns, conditional questions (rural premises, convictions, sequestration). Add or reorder questions, then save; the portal and counter forms change immediately. The **Office use** tab holds NA / R / C of O, registration reference, town planning and EHO reports. |
| 15 | nobody (public) | `/apply` → *Shop licence* | The same form on the citizen portal with "Type of application" (new, extension, removal, alteration). Office-use questions are not shown. |
| 16 | nobody (public) | `/verify` → track `LA-2026-0006` with phone `0775 666 777` | An approved application: **I have paid the fee** form (method, reference, amount, proof). Submitting it records a payment *awaiting confirmation*. |
| 17 | cashier or treasurer | Licensing → *Payments* scope | Open the application: the **Payments** table shows the reported payment; **Confirm** it (Finance or a manager) or **Reject** with a reason. Only then does **Issue licence** become available. The applicant is told when payment is confirmed. |
| 18 | secretary (admin) | WhatsApp sandbox → **my licences** → pick an approved application | The status reply shows *Fee due* and an **I have paid** button; choose the method and type the reference. The payment appears in the register awaiting confirmation. |

Service desk, approvals, advances, leave, notices, assets and fleet work as in the user manual; the sample data (water and sewer faults, refuse collection, road works, devolution-funded projects) is council-flavoured.
