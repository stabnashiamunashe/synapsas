# Security

Synapsas is built against the **OWASP Application Security Verification Standard (ASVS) 4.0, Level 2** and the **OWASP Top 10 (2021)**. This document maps the controls to the code so auditors can verify them, and lists the operational duties that remain with the operator.

Report vulnerabilities to **security@synapsas.tech** (see `/.well-known/security.txt`). Please do not open public issues for security reports.

## Control map

| ASVS area | Control | Where |
| --- | --- | --- |
| V2.1 Password security | 12–128 characters, composition, common-password list, breached-password check via Have I Been Pwned k-anonymity (`HIBP_CHECK`), no name/email in password, bcrypt cost 12 | `src/lib/security.ts`, `src/lib/auth.ts` |
| V2.2 Authenticator | Rate limits per IP and per IP+email, account lockout (org-configurable threshold, 15 min) with email alert, constant-time compare and dummy hash for unknown accounts, generic error messages | `src/app/api/auth/login/route.ts` |
| V2.5 Credential recovery | Random 256-bit reset tokens, SHA-256 hashed at rest, single use, 60-minute expiry, identical response for unknown emails, all other sessions revoked on reset, confirmation email | `auth/password/forgot`, `auth/password/reset` |
| V2.7 Out-of-band | Email verification of self-registered accounts (hashed single-use token, 24 h), invitations hashed at rest and single use (7 d) | `src/lib/verification.ts`, `src/lib/invitations.ts` |
| V2.8 One-time verifiers | TOTP (RFC 6238) with ±1 step tolerance, replay guard (last accepted step persisted), 8 attempts / 5 min, 10 single-use backup codes (hashed), secrets encrypted at rest (AES-256-GCM, key via HKDF from `AUTH_SECRET`), email alerts on enable/disable/backup-code use | `src/lib/totp.ts`, `src/lib/crypto.ts`, `auth/2fa/*` |
| V3 Session management | HS256 JWT in `__Host-` cookie (HttpOnly, Secure, SameSite=Lax, Path=/), issuer/audience pinned, session version checked against the database on every request (deactivation, password change and "sign out everywhere" take effect immediately), org-configurable lifetime (1–168 h) | `src/lib/auth.ts`, `src/lib/api.ts` |
| V4 Access control | Every query scoped by `orgId`; role hierarchy OWNER > ADMIN > MANAGER > MEMBER enforced server-side; object-level checks on requests, attachments, approvals; API keys carry `read`/`write` scopes | `src/lib/api.ts`, route handlers |
| V4.2.2 CSRF | `Sec-Fetch-Site`, then `Origin`, then `Referer` must match the host for every mutating cookie-authenticated request | `sameOrigin()` in `src/lib/security.ts` |
| V5 Input validation | Zod schemas on every body; strict JSON parsing; open-redirect guard on `?next=` | `src/lib/validators.ts`, `safeRedirectPath()` |
| V7 Logging | Audit log of all auth and business events with IP and user agent; secrets never logged; stack traces never returned to clients | `src/lib/notify.ts` (`audit`), `fail()` in `src/lib/api.ts` |
| V8 Data protection | `Cache-Control: no-store` on API responses; TOTP secrets encrypted; API keys and tokens stored as SHA-256 hashes; webhook secrets shown once and rotatable | `src/lib/api.ts`, `api-keys`, `webhooks` |
| V9 Communications | HSTS (2 years, preload) in production; TLS terminated by nginx with Let's Encrypt; SMTP requires STARTTLS/TLS 1.2+ | `next.config.ts`, `deploy/nginx`, `src/lib/mailer.ts` |
| V12 Files | Extension + MIME allowlist, magic-byte verification, 25 MB limit, random storage names, path containment check, downloads served as `attachment` with `nosniff` and a sandboxed CSP (inline only for images/PDF) | `src/lib/uploads.ts`, attachment routes |
| V12.6 SSRF | Webhook targets must be public HTTPS hosts; private/loopback ranges rejected; redirects not followed; 5 s timeout | `isSafeWebhookUrl()` in `src/lib/notify.ts` |
| V13 API | Per-principal rate limits (600/min session, 300/min API key, 60/min public per IP), `Retry-After` on 429, read-only API keys cannot mutate | `src/lib/api.ts` |
| V14 Configuration | Nonce-based CSP with `strict-dynamic` (no `unsafe-inline` scripts), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP, `X-Powered-By` removed; production refuses to boot with default or weak secrets | `src/proxy.ts`, `next.config.ts`, `src/instrumentation.ts` |
| Supply chain | `npm audit` (prod deps, high+) and CodeQL on every push; Dependabot weekly; container scanned with Trivy; non-root, read-only container with all capabilities dropped | `.github/workflows/ci.yml`, `docker-compose.yml`, `Dockerfile` |

## Email

Transactional email goes through SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`). Every message is written to the `EmailOutbox` table first, delivered immediately, and retried with backoff by `GET /api/cron/email` (schedule it every 5 minutes with `Authorization: Bearer $CRON_SECRET`). The same job sends daily and weekly digests.

Messages sent:

- Account: email confirmation, invitation, temporary password, password reset.
- Security alerts (always on): new device sign-in, password changed, 2FA enabled/disabled, backup code used, account locked.
- Workflow: approvals waiting, comments, status changes (per-user preferences, or a digest).

Templates escape all dynamic content, use table layout for Outlook, and never include secrets other than one-time links.

**Operator checklist for deliverability and anti-spoofing** (set these at your DNS provider for the sending domain):

| Record | Value |
| --- | --- |
| SPF (TXT @) | `v=spf1 include:<your SMTP provider's SPF> -all` |
| DKIM (TXT selector._domainkey) | the public key your SMTP provider gives you |
| DMARC (TXT _dmarc) | `v=DMARC1; p=quarantine; rua=mailto:dmarc@synapsas.tech; adkim=s; aspf=s` |

## Residual risks and operator duties

- **Rate limiting is per process.** Behind one container this is fine. For multiple replicas put the limiter in Redis (`rateLimit()` in `src/lib/security.ts` is the single integration point) and rely on the nginx `limit_req` zones in `deploy/nginx`.
- **Style CSP.** Scripts are nonce-only. Styles use `style-src-elem 'nonce-…'` for `<style>` tags, but React inline `style` attributes require `style-src-attr 'unsafe-inline'`; this cannot execute script and is the accepted trade-off for Ant Design.
- **Secret rotation.** Rotating `AUTH_SECRET` signs everyone out and invalidates TOTP secrets (they are encrypted with a key derived from it); users must re-enrol 2FA. Rotate `CRON_SECRET`, `PLATFORM_ADMIN_KEY` and SMTP credentials at least yearly.
- **Backups.** Back up the `db_data` and `uploads` volumes; attachments are stored on disk, not in the database.
- **Known dev-only advisories.** `npm audit` reports `braces` (via eslint tooling) and `deepmerge-ts` (via the Prisma CLI). Neither is shipped in the runtime image; both are fixed by the next major of their parents.
- **Demo seed.** Never run the seed on a production workspace: its passwords are public.
