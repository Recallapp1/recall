# Next steps for the owner

_Written 2026-10-09 at the end of the autonomous pre-launch hardening round. Everything here needs your money, an account, a login, a lawyer or a vendor, so it was prepared but not done. Nothing new is switched on in production; see "Switches" at the end._

Costs are estimates from the linked documents (checked 2026-10-08/09); confirm them on the vendor's page before paying.

## Do these first, in this order

### 1. Load Retell credit into the **Recall Dev** workspace and start evaluation stage 1

- **Steps:** Retell dashboard → switch to the **Recall Dev** workspace → Billing → add credit. Then send me: _"Recall Dev kredisi yüklendi, değerlendirme kademe 1'i başlat."_
- **Time:** 5 minutes for you; the run itself takes about 1 hour.
- **Cost:** at least **15 $** (stage 1 is estimated at 9.65 $; the run stops itself at about 11.60 $). Stage 2 later needs about **18 $** more.
- **What happens next:** 52 test calls (26 scenarios × `baseline` and `option-c-gemini`) run against the dev assistant only. The run stops cleanly if the budget or credit runs out, and the dev assistant is always switched back. Results go into [VOICE-EVAL.md](02-voice-agent/VOICE-EVAL.md) and [ADR-003](decisions/ADR-003-llm-model.md) with a recommendation.

### 2. Load Retell credit into the **production** workspace

- **Steps:** Retell dashboard → the production workspace → Billing → add credit.
- **Time:** 5 minutes.
- **Cost:** about **0.15 $ per call minute**, measured. 30 $ covers about 200 minutes of testing.
- **What happens next:** the production assistant can answer calls again; it cannot while the balance is zero. The first real test call also confirms that Retell signs webhooks with the new key.

### 3. Choose a phone line vendor (Verimor or Netgsm) and call them

- **Steps:** use the 10 questions and the comparison in [PHONE-LINE-OPTIONS.md](07-sales/PHONE-LINE-OPTIONS.md).
- **Time:** 1–2 calls, then usually a few days of paperwork. A company or sole-trader record is needed.
- **Cost:** Verimor is about **1,800 TL a month** (switchboard 478 TL + SIP Trunk module 1,299 TL); Netgsm is to be quoted.
- **What happens next:** you send me the SIP details. I import the number into Retell and run the test matrix in [CLINIC-ONBOARDING.md](07-sales/CLINIC-ONBOARDING.md).

### 4. Hire a lawyer for the KVKK review

- **Steps:** send the lawyer [docs/legal-drafts/](legal-drafts/README.md): the brief with 19 questions, the data flow and the drafts.
- **Time:** 1 hour to brief; usually 2–4 weeks elapsed.
- **Cost:** a lawyer's fee (not estimated).
- **What happens next:** I turn the reviewed texts into pages and the recording announcement, behind a switch, and fill in the DPA. Nothing legal is published until then.

### 5. Turn on paid hosting, the database plan and monitoring

- **Neon Launch plan:** about 5–19 $ a month. It adds 7 days of restore history instead of 6 hours. Afterwards I run the restore drill in [BACKUP-RESTORE.md](06-operations/BACKUP-RESTORE.md).
- **Vercel Pro:** 20 $ a month per member. Hobby does not allow commercial use, so Pro is needed before the first paying clinic. **[PLAN: Hobby]**
- **Sentry:** free Developer plan.
  - Create a Next.js project, copy its DSN and add `SENTRY_DSN` in Vercel (Production).
  - Error texts are already masked before they are sent.
- **Uptime monitoring:** free tier of Better Stack or UptimeRobot. Monitor `https://recalltr.company/api/health` and `/api/health/jobs` every minute, following [MONITORING.md](06-operations/MONITORING.md).
  - Optionally add a `HEALTH_JOBS_TOKEN` in Vercel and the same value as the `x-health-token` header in the monitor.
- **Time:** about 30 minutes in total.
- **What happens next:** tell me _"Sentry DSN eklendi"_ and I verify that a test error arrives with personal data masked.

## Later, before general sales

6. **Company and invoicing.** Company details are needed for the contracts ([KULLANIM-KOSULLARI.md](legal-drafts/KULLANIM-KOSULLARI.md)), the SIP line, SMS (İYS) and VERBIS. This takes an accountant, 1–3 weeks and their fee.
7. **Prices.** The floor prices in [COST-MODEL.md](06-operations/COST-MODEL.md) are about 10,400, 24,000 and 62,900 TL a month for 300, 1,000 and 3,000 minutes (assumed 1 USD = 50 TL; the only measured input is 0.153 $/min from 12 scripted test calls). Replace the assumptions in it (exchange rate, minutes per call, SIP per clinic) and set the prices in [PRICING.md](00-product/PRICING.md). This is a business decision and takes about 1 hour.
8. **SMS (Netgsm + İYS).** Open an account, register the sender header and get the İYS answer from the lawyer (question 15). Sending stays off until `SMS_SENDING_ENABLED` is set.
9. **Renew the local secrets.** In `.env.local`, replace `CRON_SECRET` and `BETTER_AUTH_SECRET` with new random values (`openssl rand -base64 32`). This takes 2 minutes and does not affect production.
10. **Optional cleanup in the production Retell workspace.** Delete the old dev agent ("Recall · Gülüş Diş Kliniği", which points to a dead tunnel address) and the unused "Conversation Flow Agent". I did not touch them.
11. **First pilot clinic.** Follow [CLINIC-ONBOARDING.md](07-sales/CLINIC-ONBOARDING.md). The support and incident processes are in [SUPPORT-PROCESS.md](06-operations/SUPPORT-PROCESS.md) and [INCIDENT-RESPONSE.md](06-operations/INCIDENT-RESPONSE.md); fill in the contact names and channels there.

## Switches (all OFF in production today)

Each switch is a Vercel environment variable (Production). Add it, then redeploy; remove it and redeploy to turn it off. Every switch was built so that **unset means today's behaviour**, and a test proves that.

> **Type values exactly.** On/off switches accept only `true` or `false` (lower case); unset is the same as off. Anything else (`TRUE`, `1`, `yes`, a stray space) fails the settings check on the first request, and **every request that reads settings then fails**: panel, voice webhooks and cron. The same applies to `PANEL_SESSION_HOURS` (a whole number 1–168) and `VOICE_PROMPT_VARIANT` (`full` or `compact`). After any change, check `/api/health` and open the panel once.

`RETELL_LLM_MODEL` (`claude-4.5-haiku`), `RETELL_VOICE_MODEL` (`eleven_flash_v2_5`) and `RETELL_LLM_HIGH_PRIORITY` (`false`) are already set in Production and should stay; removing `RETELL_VOICE_MODEL` is not a no-op.

| Switch                          | Accepted           | Unset                            | What it does when on                                                                                                                            | Retell sync                          | Depends on                                                                                                     | How to verify after redeploy                                                  |
| ------------------------------- | ------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `POST_CALL_FLAGS`               | `true`/`false`     | off                              | Flags finished calls (emergency, medical risk, a claim not backed by a tool result); badges in Aramalar                                         | no                                   | —                                                                                                              | after a call, `calls.flagged_at` is set; badge on a flagged call              |
| `VOICE_TOOL_IDEMPOTENCY`        | `true`/`false`     | off                              | A retried Retell tool request returns the first result, never books twice                                                                       | no                                   | —                                                                                                              | after a booking call, a row in `tool_requests`                                |
| `VOICE_TOOL_FAILSAFE`           | `true`/`false`     | off (HTTP 500)                   | Database failure before a tool runs answers an honest `ok: false`                                                                               | no                                   | —                                                                                                              | log line `retell.tool.unavailable` only on failures; needs a call to see live |
| `AUDIT_STRICT`                  | `true`/`false`     | off                              | 13 more actions stop if their audit record cannot be written                                                                                    | no                                   | —                                                                                                              | nothing visible while healthy; `ALARM audit.critical_write_failed` on failure |
| `PANEL_LIMITS_VIEW`             | `true`/`false`     | off (404)                        | Owners/admins see Ayarlar → Kullanım ve sınırlar                                                                                                | no                                   | —                                                                                                              | the page opens for an owner, not for staff                                    |
| `PANEL_GO_LIVE_CHECK`           | `true`/`false`     | off (404)                        | Owners/admins see Ayarlar → Yayına hazırlık (line, assistant, SMS, deletion queue, switch states)                                               | no                                   | —                                                                                                              | the page opens for an owner, not for staff                                    |
| `PANEL_PATIENT_EDIT`            | `true`/`false`     | off                              | Staff with `patients.update` correct a patient's name and phone (KVKK)                                                                          | no                                   | —                                                                                                              | the "Bilgileri düzelt" form on a patient page; audit entry names fields only  |
| `CALL_REVIEW`                   | `true`/`false`     | off                              | Staff report wrong assistant behaviour on a call (fixed reasons), audited                                                                       | no                                   | —                                                                                                              | the "Asistan hatası bildir" box on a call page                                |
| `TEST_CALL_FLAG`                | `true`/`false`     | off                              | Owners/admins mark test calls; marked calls leave the "Bugün" numbers                                                                           | no                                   | —                                                                                                              | "Test araması" badge; Bugün call count drops                                  |
| `PANEL_SESSION_HOURS`           | whole number 1–168 | 7 days                           | Shorter panel sessions for shared reception computers                                                                                           | no                                   | —                                                                                                              | sign in again; the session cookie's lifetime matches                          |
| `PATIENTS_PER_NAME`             | `true`/`false`     | off                              | Family members on one number get their own records (fallback while the unique index exists); call list, search, SMS opt-out, panel names follow | no                                   | migration 0019 for separate records (not added)                                                                | a family booking shows "… adına" on the appointment                           |
| `VOICE_SHARED_NUMBER_CHECK`     | `true`/`false`     | off                              | On a shared number the assistant asks name, date and time before revealing or changing                                                          | no (tool behaviour, callers hear it) | —                                                                                                              | `booked_for_name` filled on new voice bookings; needs a call                  |
| `VOICE_PROMPT_VARIANT`          | `full`/`compact`   | `full`                           | `compact`: option A's shorter prompt                                                                                                            | **yes** with `compact`               | evaluation stage 2                                                                                             | new `voice_agents.spec_hash`; Asistan page preview                            |
| `RETELL_DYNAMIC_RESPONSIVENESS` | `true`/`false`     | not sent                         | Retell adapts timing to the caller's pace                                                                                                       | **yes** (also with `false`)          | part of option A                                                                                               | new `spec_hash`; Retell dashboard setting                                     |
| `VOICE_PROMPT_HARDENING`        | `true`/`false`     | off                              | Safety-first prompt (A9)                                                                                                                        | **yes** with `true`                  | evaluation stage 2                                                                                             | new `spec_hash`; Asistan page preview                                         |
| `RETELL_LLM_MODEL`              | a Retell model id  | `claude-4.5-haiku` (already set) | Changes the model                                                                                                                               | **yes** when changed                 | ADR-003 decision                                                                                               | Retell dashboard; `voice_agents.status = synced`                              |
| `DELETION_QUEUE_HOURLY`         | `true`/`false`     | off (404)                        | `/api/cron/provider-deletions` runs the Retell deletion queue                                                                                   | no                                   | **Vercel Pro** + vercel.json entry `0 * * * *`                                                                 | the route answers counts instead of 404                                       |
| `HOURLY_REMINDERS`              | `true`/`false`     | off; daily reminders             | `/api/cron/reminders` plans reminders by `smsReminderHoursBefore`; the daily job stops planning them                                            | no                                   | **Vercel Pro** + vercel.json entry `0 * * * *`, **both together** (switch alone = no reminders)                | reminder rows appear hourly in `notifications`                                |
| `SENTRY_DSN`                    | Sentry DSN         | off                              | Server errors to Sentry, masked                                                                                                                 | no                                   | Sentry account                                                                                                 | a test error arrives masked                                                   |
| `HEALTH_JOBS_TOKEN`             | any string         | details public                   | `/api/health/jobs` details only with `x-health-token`                                                                                           | no                                   | uptime monitor header                                                                                          | without header: status only                                                   |
| `SMS_SENDING_ENABLED`           | exactly `true`     | off                              | Real SMS                                                                                                                                        | no                                   | `SMS_PROVIDER=netgsm` + 3 `NETGSM_*` (else the app fails to start), clinic setting, İYS answer from the lawyer | notification rows `sent` with provider `netgsm`                               |

Recommended order (decisions 60 and 72): first the switches callers do not hear (`POST_CALL_FLAGS`, `VOICE_TOOL_IDEMPOTENCY`, `PANEL_GO_LIVE_CHECK`); before the first clinic `AUDIT_STRICT`, `PANEL_PATIENT_EDIT`, `CALL_REVIEW`, `TEST_CALL_FLAG`; only after a real call or measurement `VOICE_TOOL_FAILSAFE`, `VOICE_SHARED_NUMBER_CHECK`, option A, hardening, a model change. Whether each default is right is reviewed in [DECISIONS-TO-REVIEW.md](DECISIONS-TO-REVIEW.md).
