# WhatsApp intake (Meta WhatsApp Business Cloud API)

Reports can be logged and tracked over WhatsApp. The conversation is driven by **reply buttons, list menus and a location request**; the only thing a person types is the description of the issue. WhatsApp is optional: when it is not configured, or Meta is unreachable, every WhatsApp step is skipped and logged, and nothing else in the system is affected.

## How it behaves

| Step | What the person sees |
| --- | --- |
| Any first message | Main menu with buttons **Report an issue · Track a report · Help** |
| Report | A list of public categories (paged with "More categories…") → one typed description → **Share location / Skip** → **Yes, &lt;name&gt; / Stay anonymous** → confirmation card with **Submit / Cancel** → reference number and SLA |
| Track | A list of the person's reports (matched by phone), or a typed reference; each shows status, target date and the latest public updates, with **Rate the service** once resolved (a 1–5 star list) |
| Help | Contact details and the two main buttons |
| Cancel / Menu | Available at every step; sessions expire after two hours of silence |

Outbound updates (case received, status changed, public reply) are sent as **approved template messages** to reporters who used WhatsApp. Switch on *Also message reporters who used the website or phone* under Settings → WhatsApp to extend this to everyone with a phone number (they must have opted in to WhatsApp messages from you).

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

Variables are filled as: reference number, title or status, SLA hours or the officer's note. Once approved, set the template names in the environment variables above. Until they are approved, outbound updates are skipped and shown as "skipped" in the message log.

## Security and resilience

- Webhook bodies are verified with `X-Hub-Signature-256` (HMAC-SHA256 with the app secret). Unsigned calls are rejected in production.
- Each inbound message is processed once (Meta retries are ignored by message id); a phone number is limited to 40 messages per 10 minutes.
- Every send has an 8-second timeout and never throws; failures are recorded in the message log with Meta's error text.
- No personal data beyond the phone number, profile name and what the person typed is stored; phone numbers are masked in the log.
- The sandbox on the settings page runs the same engine without Meta, so the flow can be tested before go-live.
