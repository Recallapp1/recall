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
- **Vercel Pro:** 20 $ a month per member. Hobby does not allow commercial use, so Pro is needed before the first paying clinic.
- **Sentry:** free Developer plan.
  - Create a Next.js project, copy its DSN and add `SENTRY_DSN` in Vercel (Production).
  - Error texts are already masked before they are sent.
- **Uptime monitoring:** free tier of Better Stack or UptimeRobot. Monitor `https://recalltr.company/api/health` and `/api/health/jobs` every minute, following [MONITORING.md](06-operations/MONITORING.md).
  - Optionally add a `HEALTH_JOBS_TOKEN` in Vercel and the same value as the `x-health-token` header in the monitor.
- **Time:** about 30 minutes in total.
- **What happens next:** tell me _"Sentry DSN eklendi"_ and I verify that a test error arrives with personal data masked.

## Later, before general sales

6. **Company and invoicing.** Company details are needed for the contracts ([KULLANIM-KOSULLARI.md](legal-drafts/KULLANIM-KOSULLARI.md)), the SIP line, SMS (İYS) and VERBIS. This takes an accountant, 1–3 weeks and their fee.
7. **Prices.** The floor prices in [COST-MODEL.md](06-operations/COST-MODEL.md) are about 9,800, 22,000 and 57,000 TL a month for 300, 1,000 and 3,000 minutes. Replace the assumptions in it (exchange rate, minutes per call, SIP per clinic) and set the prices in [PRICING.md](00-product/PRICING.md). This is a business decision and takes about 1 hour.
8. **SMS (Netgsm + İYS).** Open an account, register the sender header and get the İYS answer from the lawyer (question 15). Sending stays off until `SMS_SENDING_ENABLED` is set.
9. **Renew the local secrets.** In `.env.local`, replace `CRON_SECRET` and `BETTER_AUTH_SECRET` with new random values (`openssl rand -base64 32`). This takes 2 minutes and does not affect production.
10. **Optional cleanup in the production Retell workspace.** Delete the old dev agent ("Recall · Gülüş Diş Kliniği", which points to a dead tunnel address) and the unused "Conversation Flow Agent". I did not touch them.
11. **First pilot clinic.** Follow [CLINIC-ONBOARDING.md](07-sales/CLINIC-ONBOARDING.md). The support and incident processes are in [SUPPORT-PROCESS.md](06-operations/SUPPORT-PROCESS.md) and [INCIDENT-RESPONSE.md](06-operations/INCIDENT-RESPONSE.md); fill in the contact names and channels there.

## Switches (all OFF in production today)

Each one is a Vercel environment variable (Production). Add it, then redeploy. To turn it off, remove it. Unset means today's behaviour, and a test proves that for each one.

| Switch                                                                | What it does when on                                                                                                                             | When to turn it on                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `POST_CALL_FLAGS=true`                                                | After each call, flags calls with an emergency, a medical question or a claim not backed by a tool result. The flags show as badges in Aramalar. | Now; it changes nothing callers hear           |
| `VOICE_SHARED_NUMBER_CHECK=true`                                      | On a number used by several people, asks for the name before cancelling or moving an appointment                                                 | After evaluation stage 2 or a manual test call |
| `VOICE_TOOL_IDEMPOTENCY=true`                                         | A retried tool request from Retell never books twice                                                                                             | Now; nothing audible changes                   |
| `AUDIT_STRICT=true`                                                   | More actions fail when their audit record cannot be written ([AUDIT-POLICY.md](05-compliance/AUDIT-POLICY.md))                                   | Before the first clinic                        |
| `PANEL_LIMITS_VIEW=true`                                              | Owners see the read-only Ayarlar → Sınırlar page                                                                                                 | When packages and limits are final             |
| `VOICE_PROMPT_VARIANT=compact` + `RETELL_DYNAMIC_RESPONSIVENESS=true` | Option A: a shorter prompt and faster turn-taking                                                                                                | Only if evaluation stage 2 shows it is better  |
| `VOICE_PROMPT_HARDENING=true`                                         | Adds the prompt-injection and safety rules (A9)                                                                                                  | Only if evaluation stage 2 shows no loss       |
| `RETELL_LLM_MODEL=<model>`                                            | Changes the model (e.g. `gemini-3.0-flash`)                                                                                                      | After the ADR-003 decision                     |
| `SENTRY_DSN`, `HEALTH_JOBS_TOKEN`                                     | Error tracking, and job details for the uptime monitor                                                                                           | Step 5                                         |
| `SMS_SENDING_ENABLED` + Netgsm                                        | Real SMS                                                                                                                                         | Step 8                                         |

Whether each default is right is reviewed in [DECISIONS-TO-REVIEW.md](DECISIONS-TO-REVIEW.md).
