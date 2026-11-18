# WhatsApp intake (Meta WhatsApp Business Cloud API)

Reports can be logged and tracked over WhatsApp. The conversation is driven by **reply buttons, list menus and a location request**; the only thing a person types is the description of the issue. WhatsApp is optional: when it is not configured, or Meta is unreachable, every WhatsApp step is skipped and logged, and nothing else in the system is affected.

## What the chatbot does

The bot runs in English for now (free-text answers are accepted in any language; the texts live in `src/lib/whatsapp/i18n.ts`, where other languages can be added later as extra dictionaries). It opens with the greeting and six services as a list. Every flow that collects data ends the same way: summary → **Submit / Edit an answer / Cancel** → reference number → status updates pushed back to the same chat.

| # | Option | What happens | Ends in |
| --- | --- | --- | --- |
| 1 | **Latest statistics** | Area list, as on the Open Data Portal (**Macroeconomics**: National Accounts, External Trade, Labour, Price Indices, Poverty · **Demographic & Social**: Population Census, Gender, Education, Culture, Prison, Crime, Vital, Migration, Health · **Production**: Agriculture, Economic Census, Energy, Environment, Industrial, ICT, Transport and Infrastructure, Tourism · **SDGs**, which first quotes https://sdg-zimstat.github.io/) → topic list → the topic's headline indicators plus two rows: **Data from the portal** and **Download Excel or PDF**. An indicator answers with the latest figure, reference period, release date and portal link → *Another indicator / Data from the portal / Download Excel or PDF / Get alerts / Main menu*. **Data from the portal** lists the datasets the Open Data Portal files under the topic (read live from its catalogue, newest first) and sends the chosen one as a **CSV file**, an **Excel workbook** or a **chart image** (PNG line chart of its main series), fetched from the portal at that moment; **Download Excel or PDF** sends a table of the topic's headline figures generated on the spot, or a publication staff uploaded for the topic | Figures from the **Headline statistics** table; datasets from the portal catalogue; files from **Publications & files**; optional alert sign-up (per area) |
| 2 | **Request data or a table** | Requester type → name → organisation → email (checked) → subject area → description (≥ 20 chars) → geographic level → period (years, checked) → format (Excel, CSV, PDF table, SDMX) → purpose → optional supporting document → consent → summary | Service-desk case **DR-2026-0001** in the data-request category; pushes *Received → Under review → More information needed → Ready → Closed* as the case moves |
| 3 | **Verify an officer or survey** | *Field officer*: badge ID checked against the active field-staff register → name, role, survey and area to compare with the badge → *Matches the badge / Report a concern*. *Survey*: list of surveys in the field → name, period, areas, what respondents are asked | Concern only: case **VR-2026-0001** routed to Field Operations (location, date, description, optional photo) |
| 4 | **Release calendar and alerts** | Next five scheduled releases → pick topics (multi-select) → *Every release / Monthly summary* | Subscription; `stop alerts` opts out; **Publish** on a release alerts its subscribers |
| 5 | **Enquiries, feedback and complaints** | Category (public service-desk categories) → name (anonymous allowed except for complaints) → email (optional) → details → optional screenshot or document → summary | Ticket **TK-2026-0001**; the person is messaged when it is assigned, answered and closed and can rate it 1–5 |
| 6 | **Talk to a ZIMSTAT officer** | Topic → in office hours (Settings → Organisation working hours) a **live chat** case is opened with the conversation so far; every message the person types becomes a public comment and officers' public replies are delivered to the chat. After hours the bot offers to log the question as a ticket | Case **TK-…** (live chat) |
| | **My requests and status** | Lists the person's DR/VR/TK references by phone number, or type `status DR-2026-0001` at any time | |

**Common rules.** `menu` or `0` returns to the main menu (an unfinished form is kept as a draft and offered as *Continue*); `back` repeats the previous question; `cancel` ends the current flow without saving; `exit` ends the session (after confirming if a draft exists). Email, year, date and file checks run at each step; after three failed attempts the bot offers a live officer. Drafts are kept for 24 hours. Attachments (PDF, Word, Excel, images) are downloaded from Meta by media id and stored with the case after the same allow-list and magic-byte checks as every upload. Consent is captured before personal details are stored; `delete my data` logs an erasure request as a ticket.

**Content and routing** live under *Settings → Chatbot content*: headline statistics (one row per indicator, overwrite the value on each release; topics follow the portal's taxonomy and figures saved under the earlier keys CPI, GDP, POP, LAB, TRADE, AGRI and HEALTH still show under their new topic), publications and files (PDF, Excel, CSV or Word up to 25 MB per topic or for all topics, with a preview of the generated Excel/PDF tables), the release calendar with a **Publish** button that alerts subscribers, the field-staff register and surveys, and which service-desk categories receive data requests, verification concerns and live chats. Menu options can be switched off individually for a phased rollout (pilot: statistics, enquiries, live chat; then data requests and alerts; then field verification). The seed (`prisma/seed-chatbot.ts`, also run by the main seed) loads **sample** figures, releases, surveys, officers and enquiry categories; replace the figures before going public.

**Open Data Portal datasets.** The portal is an Istat *Data Browser*; the bot uses its public API from the address in *Routing & options → Open Data Portal link* (default https://zimstat.opendataforafrica.org): `GET /api/Core/nodes/1/catalog` for the topic tree and dataset titles (cached 30 minutes; each bot topic maps to one or more portal category ids in `STAT_TOPICS[].odp`, e.g. National Accounts → `MAC_NA_Q` + `MAC_NA_A`), and `POST /api/Core/nodes/1/datasets/{id}/download/jsondata` with body `[]` for a whole dataset as SDMX-JSON. `src/lib/whatsapp/odp.ts` flattens it into a table (dimensions that vary become columns, constant ones are listed once in the caption and the Excel *About* sheet), writes the CSV (UTF-8 with BOM) or Excel workbook, and `odpChart.tsx` draws up to six series (totals first) as a 1200×675 PNG with Next's `ImageResponse`, so no browser or system fonts are needed. Responses over 30 MB or 100 000 rows are cut off and the person gets the portal link instead; a portal outage hides the portal rows until the catalogue answers again. The *Publications & files* tab shows, per topic, which portal categories and datasets the bot currently offers, with a chart preview; staff check a file at `/api/chatbot/odp?dataset=<id>&format=csv|xlsx|png`. If the server log says `[odp] catalogue unavailable fetch failed SELF_SIGNED_CERT_IN_CHAIN`, outbound TLS is being inspected on that machine (typical on office networks): give Node the inspection root with `NODE_EXTRA_CA_CERTS=/path/to/root.pem` rather than disabling certificate checks. `npx tsx scripts/odp-smoke.ts <out-dir>` lists what the portal offers per topic and writes one dataset as CSV, Excel and PNG without the web server.

**Files on WhatsApp.** A document or image reply is produced when it is sent: the Excel/PDF is generated (or the uploaded file read from `UPLOAD_DIR/<org>/chatbot`), pushed to Meta's media store (`POST /{phone-number-id}/media`) and sent as a `document` message with filename and caption, so no public download URL is needed. If generation or upload fails the person gets a short apology with the ODP link instead and the failure is logged in the message log. The sandbox cannot upload to Meta, so it shows the file as a card (or the chart inline) that opens the same bytes from `/api/chatbot/export`, `/api/chatbot/documents/{id}/download` or `/api/chatbot/odp`.

Outbound messages: inside the 24-hour window after the person's last message, replies and status changes are sent as plain text, so officer replies work before any template is approved. Outside the window Meta requires **approved templates** (below); until they exist those updates are skipped and shown as "skipped" in the message log.

## One-time setup in Meta

1. In [Meta for Developers](https://developers.facebook.com/) create a Business app, add the **WhatsApp** product and note the **Phone number ID** (WhatsApp → API Setup).
2. Create a **System User** in Business Settings with the `whatsapp_business_messaging` and `whatsapp_business_management` permissions and generate a **permanent access token**.
3. Copy the **App secret** from App Settings → Basic.
4. Set these on the server (`.env`) and restart:

   ```
   WHATSAPP_ACCESS_TOKEN=...
   WHATSAPP_PHONE_NUMBER_ID=...
   WHATSAPP_APP_SECRET=...
   WHATSAPP_VERIFY_TOKEN=<any long random string>
   WHATSAPP_TEMPLATE_CASE_CREATED=case_received
   WHATSAPP_TEMPLATE_CASE_UPDATE=case_update
   WHATSAPP_TEMPLATE_RELEASE=release_alert
   WHATSAPP_TEMPLATE_LANG=en
   ```

5. In WhatsApp → Configuration, set the **Callback URL** to `https://<your-host>/api/whatsapp/webhook`, the **Verify token** to the value of `WHATSAPP_VERIFY_TOKEN`, click Verify, and subscribe to the **messages** webhook field.
6. Open Settings → WhatsApp in the app: the connection card shows what is set, and *Send test buttons* confirms outbound delivery (the recipient must have messaged your number within 24 hours, or use *Send test template*).

## Templates to create (WhatsApp Manager → Message templates, category *Utility*)

Interactive buttons and lists inside a conversation need no approval. Messages **we** start (confirmations and updates) must be approved templates. Create these two with the exact variable order:

**`case_received`** (language: English)

```
Body:   Thank you. Your report {{1}} ("{{2}}") has been logged. Our target is to attend to it within {{3}} hours. We will message you here when it progresses.
Button: Visit website → URL  https://<your-host>/track/{{1}}   (dynamic URL)
```

**`case_update`** (language: English)

```
Body:   Update on your report {{1}}: status is now {{2}}. {{3}}
Button: Visit website → URL  https://<your-host>/track/{{1}}   (dynamic URL)
```

**`release_alert`** (language: English)

```
Body:   New release from ZIMSTAT: {{1}} ({{2}}). {{3}} Reply "stop alerts" to unsubscribe.
```

Variables are filled as: reference number, title or status, SLA hours or the officer's note; for the release alert: title, topic, summary or link. Once approved, set the template names in the environment variables above. Until they are approved, outbound updates are skipped and shown as "skipped" in the message log.

## Security and resilience

- Webhook bodies are verified with `X-Hub-Signature-256` (HMAC-SHA256 with the app secret). Unsigned calls are rejected in production.
- Each inbound message is processed once (Meta retries are ignored by message id); a phone number is limited to 40 messages per 10 minutes.
- Every send has an 8-second timeout and never throws; failures are recorded in the message log with Meta's error text.
- No personal data beyond the phone number, profile name and what the person typed is stored; phone numbers are masked in the log.
- The sandbox on the settings page runs the same engine without Meta, so the flow can be tested before go-live.
