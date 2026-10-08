# Recall: Development Status Report

> **Tarihli belge (7 Ekim 2026).** Bundan sonraki değişiklikler burada yok; güncel durum: [WORKLOG.md → Güncel durum](../WORKLOG.md#güncel-durum). Bu rapordaki bulguların çoğu 7–8 Ekim'de kapandı ([HARDENING-2026-10.md](HARDENING-2026-10.md)).

**Date:** 7 October 2026 (Istanbul) · **Covers:** first commit (`8bf14be`, 4 Oct 2026 12:50) to `58023ca` (7 Oct 2026 11:34)
**Stage:** development. No clinic is using the product. Production runs with test data only.
**Prepared by:** Claude (Opus 5.5), from git history, WORKLOG, plan, ADRs, code, test runs, the production database (read-only queries), Vercel, Retell and GitHub.

> Written in English at the product team's request (to hand to another assistant). Project documents are otherwise Turkish.

---

## 0. Snapshot

| Item                                     | Value                                                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Age of the project                       | 4 calendar days (4–7 Oct 2026), 85 commits on `main`                                                                                                                                          |
| Code                                     | 254 TypeScript files, ~30,400 lines (of which ~4,300 test code)                                                                                                                               |
| Pages / server-action files / API routes | 34 pages, 12 server-action files, 8 route handlers (auth, health, 3 Retell webhooks, 2 crons, patient export)                                                                                 |
| Database                                 | Postgres (Neon, Frankfurt), 27 tables, 12 enums, 10 migrations (`0000`–`0009`)                                                                                                                |
| Tests                                    | **326 tests in 26 files, all passing locally** (`pnpm test`, exit code 0, ~18 s)                                                                                                              |
| CI (GitHub Actions)                      | **Failing on every run since the first one (38/38).** Cause found (section 4.1); tests never ran in CI                                                                                        |
| Production                               | https://recalltr.company, Vercel Hobby (`fra1`), Neon free plan, Resend (eu-west-1), Retell                                                                                                   |
| Production data                          | 1 clinic (Recall Demo Diş Kliniği), 1 user (platform admin), 1 patient, 6 appointments, 7 calls (571 s, $1.37 Retell cost), 0 phone numbers, 4 notification rows (none sent), 38 audit events |
| SMS                                      | **No real SMS can be sent anywhere.** `SMS_SENDING_ENABLED` is not set in any environment; no Netgsm credentials exist                                                                        |
| Real phone calls                         | **Not possible yet.** No Turkish number is connected (F2). The assistant is reachable only through browser (web) calls                                                                        |
| Overall development progress             | **≈ 70 %** of the work needed to start a pilot (≈ 49 % if the pilot itself and post-pilot V1 features are counted). Method in section 8                                                       |

---

## 1. Full timeline

Times are Istanbul local time from git. Phase IDs (F0–F10) come from [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md).

### 1.1 Day 1: Saturday 4 October 2026

**F0 Foundation (12:50–13:45, `8bf14be` … `3ee627a`)**

- Next.js 16 skeleton (App Router, Turbopack), React 19.2, TypeScript strict, Tailwind 4, pnpm, ESLint, Prettier, Vitest, GitHub Actions CI, `vercel.json` with region `fra1`.
- 38 documents: product (PRD, personas, user flows, roadmap, pricing), architecture, voice agent, telephony, panel, KVKK/security/retention, operations, ADR-001 to ADR-003.
- Drizzle schema with 10 tables (`clinics`, `practitioners`, `services`, `practitioner_services`, `working_hours`, `time_off`, `patients`, `appointments`, `calls`, `callback_requests`).
- Migration `0001` adds a Postgres `EXCLUDE USING gist` constraint so two appointments for the same practitioner can never overlap, even under concurrent calls. **Reason:** application-level checks are not safe when two calls book at the same moment.
- Domain logic: availability engine (pure function), booking/finding/cancelling/rescheduling (atomic, idempotent, tenant-isolated), call records with outcome priority.
- Six provider-independent voice tools (`check_availability`, `book_appointment`, `find_appointments`, `cancel_appointment`, `reschedule_appointment`, `create_callback_request`) and a system-prompt generator.
- First voice adapter was **Vapi** (later dropped, see below). SMS adapters: console and an unverified Netgsm adapter.
- 72 tests (unit + integration against real migrations using PGlite, an in-process Postgres).
- **Reason for the architecture:** real-time voice cannot run inside Vercel functions, so speech runs on a managed voice platform and all business logic stays in our backend.

**Local database without Docker (14:54, `468d94b`)**

- `pnpm db:local` serves PGlite on port 5433 because Docker Desktop would not start on the development machine.

**Planning and the key product decisions (15:25–15:34, `03d5047`, `e1f173e`)**

- Phased plan F0–F10, WORKLOG, ADR-004 (Retell), ADR-005 (DESIGN.md is the single design source).
- Product decisions recorded: voice platform is **Retell AI, not Vapi**; local providers (Netgsm etc.) to be tested; strict multi-tenancy (one codebase, unlimited clinics, differences only through data); clinics are opened by the Recall team (no public sign-up); login is email + password; panel customisation = roles/permissions + module visibility + personal preferences (no per-clinic logo or colours); panel is Turkish only (no i18n); Netgsm last; email via Resend.

**F1.1–F1.7 Move from Vapi to Retell (16:01–16:43, `6d33409`, `a3b68f1`, `73bf7c2`, `ff0dae0`, `e5cafae`, `c06cd9d`)**

- New tables `voice_agents` and `phone_numbers` (migration `0002`, moved `clinics.phone_number` into `phone_numbers`).
- Retell client, signature verification using the SDK's own `verify` (tested with real `sign`-signed requests), agent spec generation from DB data, webhooks `/api/voice/retell/{inbound,tools,events}`, agent sync with a spec hash (no API call if nothing changed; partial progress kept so a retry never creates a second agent).
- Vapi code, tests, fixtures and env variables deleted (F1.7). 22 docs moved to Retell; RETELL-SETUP guide written.
- **Decisions:** one Retell agent per clinic generated from our DB (Retell is a sync target, our DB is the source of truth); Retell built-in date/time variables used so Retell's own test console also knows today's date; agent draft version updated in place and pinned via `override_agent_version` instead of Retell's publish flow (publish not verified live).
- First live sync succeeded at the first attempt (`agent_d0b8…`, dev). First web call by the product team: Turkish judged good, appointment booked into the DB, cost $0.39 for 124 s.
- Fixes from that call: stable Turkish TTS model, Turkish call summary without names, no gendered titles ("Mehmet Bey" was used), numbers spoken as Turkish words (phone number readback changed voice when digits were used).
- **First latency measurement:** end-to-end turn p50 2.22 s / p90 3.34 s with `claude-5-sonnet` (LLM p50 1.41 s). Far above the target (p50 < 1.0 s, p95 < 1.8 s).

**F4 Design system and public website (17:13–18:49)**

- F4.1 tokens in `globals.css`, DESIGN.md components (`ActionButton`, `GlassCard`, `GlassStatCard`, `StatusTag`, `SectionShell`, …), live style guide `/dev/tasarim` (404 in production), `pnpm lint:tokens` (bans hex, `rgb()`, stock Tailwind palette) in CI.
- **Changed:** the product team asked for a full redesign the same day → **DESIGN.md v2**, navy + white palette (ADR-007), new 13-section landing page with sticky adaptive header, real demo-request form (`demo_requests` table, migration `0003`, KVKK consent, honeypot).
- **Changed:** typeface Inter → **Montserrat** (Geist removed; fonts bundled locally so the build no longer depends on Google Fonts, a finding from an external audit report).
- Several header width/spacing iterations (1152 → 1024 → 768 px).
- **Security fix (`6dfad11`):** Drizzle error messages contained query parameters (patient names/phones) and were being logged. `safeError()` added to every error log.
- F4.2 shadcn/ui (Radix) installed and re-themed to DESIGN.md tokens without an alias layer (ADR-008); new `danger`/`success-soft` tokens; panel components (`ScheduleGrid`, status/source badges, `FormField`, `EmptyState`).
- Voice fix: title abbreviations ("Dt.", "Dr.", "Uzm.") expanded before the model sees them (`spokenTitles()`).

**F3 Accounts, roles, audit; F5 panel (19:11–23:27)**

- Better Auth 1.7.7 with organization plugin (8 tables, migration `0004`), organization ↔ clinic 1:1. Public sign-up disabled even at server level. Accounts only via `pnpm clinic:member` or invitation. Passwords ≥ 10 characters, 24 h set-password links, 7-day sessions and invitations. ADR-009.
- Roles owner / admin / staff (Sekreter) / practitioner (Hekim) with a permission matrix in one file (`src/lib/permissions.ts`), dynamic access control enabled for custom roles. `requireClinic()`, `requirePermission()` → 403 page. `proxy.ts` redirects unauthenticated `/panel/**`.
- Audit log (`audit_events`, migration `0005`), no personal data in metadata.
- Panel screens: Today, Calendar (day/week, practitioner columns), Appointments (filters, pagination, status transitions), appointment booking from the panel (same rules as the assistant), Calls (masked numbers, transcript, recording on demand with audit), Callbacks, Patients (notes, **KVKK anonymisation**), Settings (clinic, hours, practitioners, services with synonyms and price ranges, assistant, booking rules, notifications, panel modules), Team (invite, roles, practitioner link, last-owner protection), audit page. Practitioners see only their own calendar and patients. Auto-refresh every 30 s.
- Every settings save: shared Zod contract → server action → domain → audit → assistant re-sync after the response (`after()`).
- **Incident:** the local PGlite database corrupted twice (WASM `Aborted()` after a long-running socket server). Recovered from scratch; mitigations added (pool size 1, 5-minute snapshots).

### 1.2 Day 2: Sunday 5 October 2026

- **Neon dev branch** replaced PGlite for local development (approved by the product team). PGlite remains for tests.
- Speed settings: `eleven_flash_v2_5` TTS (no extra cost) and Retell's priority LLM pool flag. **Changed later:** the priority pool was turned off (`RETELL_LLM_HIGH_PRIORITY=false`) because Retell offers its "Fast Tier" only for some GPT models, at double price, not for Claude.
- **Model change:** `claude-5-sonnet` → **`claude-4.5-haiku`** (product team: Turkish quality enough, "a bit faster"). Estimated cost ~**$0.12/min** (Retell infra 0.055 + ElevenLabs 0.040 + Haiku 0.025).
- Browser test call from the panel (Settings → Assistant), using single-use Retell web-call tokens (`retell-client-js-sdk` 3.0.2).
- Holidays and leave (`time_off` UI, 2026–2027 Turkish public holiday template incl. half days), personal preferences (`member_preferences`, migration `0006`).
- **F6 Recall console** (`/admin`, ADR-010, migration `0007`): platform-admin role (no impersonation for anyone), clinic list with metrics, create clinic in one transaction (sector template, owner, optional number), clinic detail (go-live checklist, create/sync assistant, attach number, pause/resume, 30-day metrics/cost), demo-request tracking. **No patient data is shown in the console.**
- **Bug "connection problem" in test calls (`ab7dbd0`), root causes fixed:** the agent's webhook pointed to a dead quick tunnel (→ `pnpm dev:tunnel` that rewrites `APP_URL` and re-syncs agents, plus a pre-call reachability check); Retell's `{{user_number}}` is empty on web calls (→ own `caller_number` variable); the model dropped a phone digit (→ phone sent in spoken groups, `INVALID_PHONE` error makes it ask again); the model announced "booked" before the tool result (→ prompt rule).
- **Not supported by design:** Retell's simulation-test API (it sends no `agent_id`, and the tenant is always resolved from the agent).

### 1.3 Day 3: Monday 6 October 2026

- **No false SMS claims (`1a8b916`):** the assistant said "we sent you an SMS" while SMS was in console mode. SMS providers now report whether they deliver (`delivers`).
- **F8 production went live:** Vercel project `recall` (team `recall25`), GitHub-connected, `main` push = production deploy; Neon `production` branch; domain `recalltr.company` (+ `www` redirect); Resend domain fixed (duplicate Tokyo + Ireland records removed, DMARC added); security headers (HSTS, nosniff, frame deny, referrer policy, permissions policy with microphone only on our origin), robots, sitemap, OG images, Turkish 404. Secrets entered by the product team as "sensitive"; `BETTER_AUTH_SECRET` and `CRON_SECRET` generated directly into Vercel (nobody saw them). Preview environment deliberately has no env vars (preview builds run migrations and must never touch production).
- Product team opened the demo clinic from the console; first production web call booked into the production DB.
- **Assistant voice selection** with previews (ElevenLabs voices of the shared TTS model; assistant name set to "Elif").
- **F7 KVKK retention (`935ad2d`):** daily `/api/cron/retention` (recording link 30 days, transcript 90 days, caller number 2 years); Retell agents keep data 30 days and use signed recording URLs; if recording is off, the call is deleted from Retell after analysis; anonymisation also deletes audio at Retell; patient data export (JSON) with new `patients.export` permission and audit. **Tried and dropped:** Retell's `basic_attributes_only` (it also deletes transcript and summary from our webhook, so the panel would lose them).
- **Custom roles UI** (clinic-data permissions only; cannot include team, billing or organisation rights; name fixed after creation; role in use cannot be deleted).
- **Takip (patient follow-up) feature**: proposal written first (`docs/proposals/TAKIP.md`), approved with decisions (presumed attendance with correction, consent per plan, provider-agnostic stub, no practitioner access in V1, feature flag, no real SMS).
- **Takip V0 (`c56e329`, migration `0008`):** `notifications` outbox table, appointment reminders planned the day before (stub), `too_late` rows for same-day appointments, dispatch with `SKIP LOCKED`, at-most-once sending, 3 attempts, 09:00–20:00 window, caps (100 per clinic per day, 1 per patient per day), **three SMS locks** (`SMS_SENDING_ENABLED` only "true", provider `delivers`, clinic setting), generic SMS templates without patient name or service, daily `/api/cron/notifications`. Cron routes share a constant-time secret check.
- **Voice fixes (`8e0ab07`, `b24075f`, `b14f6ad`):** never guess the service, ask about ambiguous words (e.g. "çekim" vs "sekiz Ekim"), one booking per call unless asked, no specific time before checking availability, server-side `PATIENT_BUSY` guard (same phone cannot hold overlapping voice bookings).
- **Test flakiness root cause (`e819062`, `2d74425`):** date-fns barrel imports and, mainly, every test file re-applying all migrations in parallel with too-short hook timeouts. Now the DB is migrated once and loaded from a snapshot; suite time 20–36 s → 13–18 s.
- **Process mistake (recorded):** twice in this period a commit/push happened while tests failed, because a shell pipe hid the exit code (`b24075f` pushed, one local commit). Since then every commit is gated on the real exit code.

### 1.4 Day 4: Tuesday 7 October 2026

- **Takip V1 (`021a086` … `160e205`, migration `0009`):** rules → plans (snapshot of the rule) → visits; presumed attendance derived ("otomatik sayıldı") and correctable; auto-link of new appointments only when exactly one candidate plan exists, otherwise "needs review"; reschedule moves the link in the same transaction; reminders 7 days before due and 14 days after (only the latest applicable one); composite foreign keys (`clinic_id`, `id`) on every cross-table reference so cross-tenant links are impossible in the database; Takip tab, plan detail, rule editor with live preview, start from appointment or patient page, "SMS istemiyor" (patient opt-out), console module switch, KVKK hooks (anonymise deletes plans, export includes them, closed plans deleted after 2 years). 24-item decision log in TAKIP.md.
- **Production deploy of V1** after a Neon backup branch (`backup-pre-0009-2026-10-07`); verified build, health, 10 migrations, Takip off everywhere, no SMS possible.
- **Production real-call test** with the ambiguous phrase: the assistant asked "only teeth whitening, or an extraction too?", asked which Thursday, booked exactly one appointment.
- Product team switched Takip on for the demo clinic in the console (audited), created 2 rules and 1 plan.
- **First daily notification run** (07:44 UTC = 10:44 Istanbul): 3 reminders planned and recorded as `skipped (sending_disabled)`, 1 `too_late`, nothing sent. Learned: on Vercel Hobby, a daily cron fires at any minute within its hour (docs corrected, `3f6ca7e`).
- **Production `DATABASE_URL` switched to `sslmode=verify-full`** after a local driver test (removed a `pg` security warning; verified health, voice tool call, cron 200 with secret, `58023ca`).

### 1.5 Things tried, changed or dropped (summary)

| From                                | To                                      | Why                                                                                                       |
| ----------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Vapi                                | Retell AI                               | Product decision (ADR-004): Turkish support, inbound webhook, SIP trunk, Claude models, per-clinic agents |
| Inter (and Geist)                   | Montserrat                              | Product team preference; local font package removes build-time Google Fonts dependency                    |
| DESIGN.md v1                        | DESIGN.md v2 navy + white               | Product team redesign request (ADR-007)                                                                   |
| PGlite local server                 | Neon `dev` branch                       | PGlite corrupted twice; Neon is the same engine as production                                             |
| `claude-5-sonnet`                   | `claude-4.5-haiku`                      | Latency (LLM was the largest share); quality judged sufficient                                            |
| `eleven_multilingual_v2`            | `eleven_flash_v2_5`                     | Earlier first audio, same price                                                                           |
| Priority LLM pool on                | off                                     | Not offered for Claude at Retell; doubled price where offered                                             |
| `{{user_number}}`                   | own `caller_number`                     | Empty on web calls                                                                                        |
| Retell `publish` flow               | draft updated in place + pinned version | Publish behaviour not verified live                                                                       |
| Retell `basic_attributes_only`      | delete call after analysis              | The former removed transcript/summary from our webhook                                                    |
| Hourly reminder cron (plan F2.3)    | daily cron, reminder "day before"       | Vercel Hobby allows one run per day                                                                       |
| `notifications` design in plan F2.3 | outbox V0 (dedupe key, locks, caps)     | Safer, testable, provider-agnostic                                                                        |
| Orphaned `better-auth` stash        | clean install                           | Stash contained only the dependency; stash now gone                                                       |
| Vercel MCP                          | Vercel CLI                              | MCP connection was read-only (403)                                                                        |

### 1.6 Test count over time

72 (F0) → 82 (F1) → 85 → 105 → 107 → 114 → 123 → 197 (F3) → 216 (F5) → 223 → 229 → 230 → 241 → 289 (Takip V0) → **326 (Takip V1, today)**.

---

## 2. Status of every phase and module

Legend: ✅ done · ✅⚠ done but not fully tested · 🟡 partial · ⏳ not started · ➡ planned for a later version.

### 2.1 Phase overview

| Phase | Title                                    | Status                                                        | Notes                                                                                                                                                   |
| ----- | ---------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F0    | Foundation                               | ✅                                                            |                                                                                                                                                         |
| F1    | Retell voice core                        | 🟡                                                            | F1.1–F1.7 ✅; F1.8 evaluation (20 scenarios, model comparison, latency, ASR/TTS comparison) not done systematically                                     |
| F2    | Telephony (SIP) and SMS: Netgsm          | ⏳                                                            | Deliberately last; only an unverified Netgsm SMS adapter skeleton and the SMS outbox/locks exist                                                        |
| F3    | Accounts, auth, roles, clinic management | ✅⚠                                                           | All features done; server-action level tenant tests and E2E missing                                                                                     |
| F4    | Design system and website                | 🟡                                                            | Tokens, components, landing ✅; logo/hero visual, Lighthouse/accessibility audit, table sorting missing                                                 |
| F5    | Clinic panel                             | ✅⚠                                                           | All screens done and browser-checked; no E2E, no server-action tests, no systematic 375/1440 px visual check                                            |
| F6    | Recall console                           | ✅                                                            | Number import into Retell waits for F2                                                                                                                  |
| F7    | KVKK, security, retention                | 🟡                                                            | Retention, anonymisation, export, Retell retention ✅; rate limiting, CSP, encryption assessment, legal texts, security review, dependency scan missing |
| Takip | Patient follow-up                        | ✅ V0 + V1 in production (off by default, on for demo clinic) | V1.1, V2 later                                                                                                                                          |
| F8    | Production                               | 🟡                                                            | Live; monitoring (Sentry/uptime), green CI, `main` protection, preview environment missing                                                              |
| F9    | Pilot (3 clinics)                        | ⏳                                                            | Needs F2 and the non-development blockers                                                                                                               |
| F10   | V1 and later                             | ➡                                                             | Billing, self-service sign-up, integrations, etc.                                                                                                       |

### 2.2 Module-by-module

| Area    | Module                                                                                                         | Status                                   | Evidence / gap                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Data    | Schema (27 tables, 12 enums), 10 additive migrations                                                           | ✅                                       | Migration safety test checks 0008/0009 only create/add                                                        |
| Data    | Double-booking guard (DB exclusion constraint)                                                                 | ✅                                       | Integration tests                                                                                             |
| Data    | Composite tenant FKs                                                                                           | ✅ (Takip and notifications tables only) | Older tables rely on application-level `clinicId` filters                                                     |
| Domain  | Availability engine                                                                                            | ✅                                       | 20 tests                                                                                                      |
| Domain  | Booking / cancel / reschedule / find                                                                           | ✅                                       | 15 integration tests                                                                                          |
| Domain  | Speech helpers (numbers, dates, phone, titles)                                                                 | ✅                                       | 22 tests                                                                                                      |
| Domain  | Panel data layer, settings                                                                                     | ✅                                       | 12 + 9 tests                                                                                                  |
| Domain  | Calls, demo requests, preferences, audit writer                                                                | ✅⚠                                      | No dedicated tests (exercised indirectly)                                                                     |
| Voice   | Prompt generator                                                                                               | ✅                                       | 15 tests                                                                                                      |
| Voice   | Retell agent spec, sync, webhooks, signature                                                                   | ✅                                       | 8 + 6 + 12 tests                                                                                              |
| Voice   | Six tools                                                                                                      | ✅⚠                                      | `cancel_appointment` and `reschedule_appointment` are not called in any webhook test (domain logic is tested) |
| Voice   | Browser test call                                                                                              | ✅⚠                                      | Reachability pre-check tested; product team used it successfully                                              |
| Voice   | Voice selection                                                                                                | ✅                                       | 3 tests                                                                                                       |
| Voice   | Real phone calls (SIP inbound, caller ID, transfer)                                                            | ⏳                                       | F2                                                                                                            |
| Voice   | Scenario evaluation (20 scenarios), latency targets                                                            | ⏳                                       | About 10 real web calls done ad hoc; harness lives outside the repo                                           |
| Auth    | Better Auth, invite-only, password flows                                                                       | ✅                                       | 8 integration tests                                                                                           |
| Auth    | Roles and permissions matrix                                                                                   | ✅                                       | 64 tests                                                                                                      |
| Auth    | Custom roles                                                                                                   | ✅⚠                                      | Browser-tested; no automated test of the UI/actions                                                           |
| Auth    | Rate limiting on login                                                                                         | 🟡                                       | Only Better Auth's default in-memory limiter, which is per serverless instance (weak on Vercel)               |
| Panel   | Today, Calendar, Appointments, Calls, Callbacks, Patients, Settings (9 pages), Team, Audit, Preferences, Takip | ✅⚠                                      | Browser-checked during development; no E2E                                                                    |
| Panel   | Live updates                                                                                                   | 🟡                                       | 30 s polling; SSE ➡ V1                                                                                        |
| Panel   | Table sorting                                                                                                  | ⏳                                       | Filters and pagination exist; column sorting not built                                                        |
| Console | Clinics, create, detail, pause, sync, metrics, demo requests, module switch                                    | ✅                                       | 4 tests (+ browser)                                                                                           |
| Console | Import number into Retell                                                                                      | ⏳                                       | F2                                                                                                            |
| Website | Landing (13 sections), demo form, SEO basics, 404                                                              | ✅                                       | Logo and hero visual are placeholders (CSS)                                                                   |
| Website | Legal pages (KVKK aydınlatma, privacy, cookies)                                                                | ⏳                                       | Postponed by product team until company details exist                                                         |
| Email   | Resend adapter, Turkish templates (invite, password)                                                           | ✅                                       | Emails land in spam (new domain)                                                                              |
| Email   | Demo-request notification to the Recall team                                                                   | ⏳                                       | Requests are only listed in the console                                                                       |
| SMS     | Outbox, locks, templates, caps, window, stub provider                                                          | ✅                                       | 18 tests + 33 production-safety tests                                                                         |
| SMS     | Netgsm provider                                                                                                | 🟡                                       | Adapter written against assumptions, never called                                                             |
| SMS     | Voice-tool SMS (confirmation, cancellation, reschedule)                                                        | 🟡                                       | Bypasses the outbox: no log, no opt-out check, no window (safe today because nothing can send)                |
| Takip   | V0 notifications                                                                                               | ✅                                       | In production since 6 Oct; first daily run verified                                                           |
| Takip   | V1 rules/plans/visits/linking/UI/KVKK                                                                          | ✅                                       | 13 + 18 tests; in production since 7 Oct                                                                      |
| Takip   | V1.1 auto-start, apply rule changes to existing plans, SMS usage view, hourly job                              | ➡                                        | Needs Vercel Pro for hourly job                                                                               |
| Takip   | V2 multi-step protocols, assistant suggestion, inbound STOP, practitioner access                               | ➡                                        |                                                                                                               |
| KVKK    | Anonymisation (incl. Retell audio), export, retention cron                                                     | ✅                                       | Durations pending legal review                                                                                |
| KVKK    | No personal data in logs (`safeError`, redacted payload errors)                                                | ✅                                       | 3 tests; reviewed in several fixes                                                                            |
| KVKK    | Field-level encryption of transcripts/phones                                                                   | ⏳                                       | Not even assessed yet                                                                                         |
| Ops     | Vercel production, crons, domain, headers                                                                      | ✅                                       |                                                                                                               |
| Ops     | Monitoring and alerting                                                                                        | ⏳                                       | Hobby keeps runtime logs ~1 hour                                                                              |
| Ops     | CI                                                                                                             | ❌ broken                                | Section 4.1                                                                                                   |
| Ops     | Backups                                                                                                        | 🟡                                       | Neon free-plan history only; one manual backup branch                                                         |

---

## 3. Remaining development work

Effort: **S** ≈ under half a day, **M** ≈ 1–3 days, **L** ≈ more than 3 days (agent-assisted pace seen in this project; human review time extra).

| #   | Work item                                                                                                                                                                                                                                                                                              | Effort                              | Depends on                                      | Notes                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Fix CI: generate Next.js route types before `tsc` (`next typegen && tsc --noEmit`)                                                                                                                                                                                                                     | S                                   | —                                               | Verified in a clean clone: typecheck, format, 326 tests all pass after the change |
| 2   | Protect `main` (require green CI before merge/push)                                                                                                                                                                                                                                                    | S                                   | 1, product team (GitHub setting)                | Today a red build could deploy because Vercel builds independently                |
| 3   | Documentation and config hygiene: plan status table, ADR-003 header (still proposes Opus), `.env.example` model defaults (`claude-5-sonnet`, `eleven_multilingual_v2` vs real Haiku/Flash), stale stash note, dev agent re-sync (dev agent still points to a dead tunnel and has the priority flag on) | S                                   | —                                               |                                                                                   |
| 4   | Route voice-tool SMS (confirmation, cancellation, reschedule) through the notifications outbox with opt-out, window and log                                                                                                                                                                            | M                                   | —                                               | Must be done before SMS is ever enabled                                           |
| 5   | Rate limiting: login/password reset, demo form, webhooks (shared store, e.g. Postgres or Upstash)                                                                                                                                                                                                      | M                                   | Decision on store (free option: Postgres table) | Better Auth's default limiter is per instance                                     |
| 6   | Content-Security-Policy (with Retell web-call and Vercel requirements)                                                                                                                                                                                                                                 | S–M                                 | —                                               | Needs testing of the browser test call                                            |
| 7   | Monitoring: error tracking (Sentry or similar), uptime check on `/api/health`, log drain or longer retention                                                                                                                                                                                           | S–M                                 | Product team account(s)                         | Hobby keeps logs ~1 h; incidents can't be investigated later                      |
| 8   | Server-action integration tests (permission, validation, tenant isolation for every action file)                                                                                                                                                                                                       | M                                   | —                                               | 12 action files untested at action level                                          |
| 9   | Playwright E2E: login → book → cancel; settings → sync; unauthorised role; Takip flow                                                                                                                                                                                                                  | M–L                                 | 8 helpful                                       | Needs a test DB and fake Retell                                                   |
| 10  | Voice evaluation (F1.8): 20 scenarios, repeatable harness in the repo (TTS-driven web calls or text-mode), latency measurement (turn and tool p95), model decision recorded in ADR-003                                                                                                                 | M–L                                 | —                                               | Today: ~10 ad-hoc calls; latency only measured on Sonnet                          |
| 11  | Security review (`/security-review`), dependency scan (`pnpm audit`, Dependabot)                                                                                                                                                                                                                       | S–M                                 | —                                               |                                                                                   |
| 12  | Field-level encryption assessment (transcripts, phone numbers)                                                                                                                                                                                                                                         | S (assessment) / M (implementation) | Legal input                                     |                                                                                   |
| 13  | Legal pages (aydınlatma metni, privacy, cookie notice) as pages with placeholders                                                                                                                                                                                                                      | S                                   | Company details and lawyer texts                | Postponed by product team                                                         |
| 14  | Demo-request email to the Recall team                                                                                                                                                                                                                                                                  | S                                   | —                                               |                                                                                   |
| 15  | Migrate browser test call off `retell-client-js-sdk` 3.x token API (removed in 4.0)                                                                                                                                                                                                                    | S–M                                 | —                                               | Not urgent until upgrading                                                        |
| 16  | Name normalisation from voice (e.g. "deneme test" → "Deneme Test")                                                                                                                                                                                                                                     | S                                   | —                                               | Cosmetic; matched patient by phone so no data damage                              |
| 17  | Panel table column sorting; Lighthouse/accessibility pass; 375/1440 px visual check                                                                                                                                                                                                                    | M                                   | —                                               |                                                                                   |
| 18  | Logo and hero visual integration                                                                                                                                                                                                                                                                       | S                                   | Assets from product team                        |                                                                                   |
| 19  | **F2 Netgsm SIP trunk → Retell**: import number, attach in console, inbound tests (caller ID, hidden number, transfer/REFER), call routing scenarios                                                                                                                                                   | L                                   | Netgsm account, company, number                 | Also verifies pinned draft version on real phone calls                            |
| 20  | **F2 Netgsm SMS**: verify API against current docs, sender header, Turkish character/length, delivery reports                                                                                                                                                                                          | M                                   | Netgsm account, approved header, İYS/legal      |                                                                                   |
| 21  | Provider evaluation document (Netgsm, Verimor, one more)                                                                                                                                                                                                                                               | M                                   | Accounts at providers                           |                                                                                   |
| 22  | Takip V1.1 (auto-start, apply rule edits, SMS usage view, hourly job)                                                                                                                                                                                                                                  | M                                   | Vercel Pro for hourly                           |                                                                                   |
| 23  | Move off Hobby/free: Vercel Pro, Neon paid (no auto-suspend, longer history), hourly reminder job                                                                                                                                                                                                      | S (technical)                       | Product team purchase                           | Vercel Hobby is not meant for commercial use                                      |
| 24  | F9 pilot tooling: weekly metrics report, eval set run weekly, feedback loop                                                                                                                                                                                                                            | M                                   | Pilot clinics                                   |                                                                                   |
| 25  | F10: billing (iyzico/Stripe), self-service sign-up, Google Calendar, outbound webhooks, multi-branch, outbound calls, WhatsApp, multi-language                                                                                                                                                         | L each                              | Pilot results                                   | Post-pilot                                                                        |

---

## 4. Known bugs, limitations and technical debt

### 4.1 Bugs and broken things

| #   | Issue                                                                                                                                                                                                                                                                                                                                               | Impact                                                                                                             | Status                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| B1  | **CI has failed on all 38 runs since 4 Oct.** `pnpm typecheck` runs `tsc` on a clean checkout where Next.js's generated global types (`PageProps`, `LayoutProps`, `RouteContext`) don't exist yet. Format check and tests are then skipped, so **tests have never run in CI**. Locally the types exist in `.next/`, which is why it was not noticed | No automated safety net on pushes; nobody noticed because Vercel's build does its own type generation and succeeds | Root cause verified; fix is one line (not applied; this task is read-only) |
| B2  | Voice-tool SMS (confirmation/cancellation/reschedule) bypass the outbox: no opt-out check, no send window, no log                                                                                                                                                                                                                                   | Would violate "SMS istemiyor" and the window once SMS is enabled                                                   | Harmless today (no SMS can be sent); must be fixed before F2 SMS           |
| B3  | Dev Retell agent points to a dead tunnel and has the priority-pool flag on                                                                                                                                                                                                                                                                          | Dev test calls fail until `pnpm dev:tunnel`; no production effect                                                  | Open (trivial)                                                             |
| B4  | The model passes patient names in lower case ("deneme test")                                                                                                                                                                                                                                                                                        | Cosmetic for new patients                                                                                          | Open                                                                       |

No functional bug is known in production paths today.

### 4.2 Limitations (by design or by current plan)

- **No real phone number:** only browser calls work. Real inbound calls, caller ID, hidden numbers and call transfer are untested (F2).
- **Reminder timing (Vercel Hobby):** the job runs once a day somewhere between 10:00 and 10:59 Istanbul; reminders are "the day before". An appointment booked for tomorrow **after** that day's run gets no reminder (it becomes `too_late` next morning). Fixed by an hourly job on Vercel Pro (V1.1).
- **SMS reminder hour setting:** the UI only lets the clinic switch reminders on/off (24 h); the exact hour is fixed by the job.
- **PATIENT_BUSY:** the same phone cannot hold overlapping voice bookings, so a parent booking for two children at the same time by phone is refused; documented, "booking for someone else" flow is a possible later feature.
- **One booking per call** unless the caller explicitly asks for more (prompt rule).
- **Retell agent versioning:** draft updated in place and pinned with `override_agent_version`; the production agent is unpublished (`is_published: false`). Behaviour on real phone calls is to be verified in F2.
- **Retell simulation tests unsupported** (no `agent_id` in those calls).
- **Takip list** loads all plans of a clinic and filters in the app (fine at V1 scale; pagination later).
- **Takip rule edits never change existing plans** (decision 2; "apply to existing plans" in V1.1).
- **Practitioners have no Takip access** in V1 (decision 7).
- **Latency:** last objective measurement (Sonnet) p50 2.22 s per turn; Haiku/Flash judged "a bit faster" subjectively; no new measurement. F1 exit criteria (18/20 scenarios, tool p95 < 300 ms) not measured.
- **Email deliverability:** password/invite emails land in spam (new domain, no reputation).
- **Neon free plan:** compute auto-suspends when idle → first query after idle is slower (cold start inside a live call is possible); short restore history.
- **Vercel Hobby:** daily crons only, ~1 h log retention, not intended for commercial use.
- **Console** shows no patient data and has no impersonation (deliberate; support must ask the clinic).

### 4.3 Technical debt

| #   | Debt                                                                                                                                                                                                                                                                                           | Effort         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| D1  | CI broken (B1) and `main` unprotected                                                                                                                                                                                                                                                          | S              |
| D2  | Stale docs: plan status table and several checkboxes (e.g. F1 "waiting for Retell key", F7 "not started", Takip V1 "local branch", Vercel Cron unchecked, security headers unchecked), ADR-003 header/status, `.env.example` defaults, WORKLOG mention of `stash@{0}` (stash no longer exists) | S              |
| D3  | Real-call voice test harness (Windows TTS → fake microphone → headless Chrome) lives outside the repo                                                                                                                                                                                          | S–M            |
| D4  | Several modules have no direct tests: `calls.ts`, `audit.ts`, `demo-requests.ts`, `preferences.ts`, email templates, Retell `recordings.ts`/`schedule-sync.ts`, voice tool wrappers for cancel/reschedule                                                                                      | M              |
| D5  | Older tables use application-level tenant filters only (composite FKs exist only for Takip/notifications)                                                                                                                                                                                      | M (if desired) |
| D6  | `retell-client-js-sdk` 3.x token API removal in 4.0                                                                                                                                                                                                                                            | S–M            |
| D7  | Rate limiting in-memory only; no CSP                                                                                                                                                                                                                                                           | M              |
| D8  | Merged local branches (`docs/*`, `feat/V1-takip`) not deleted; untracked `outputs/` folder (external audit report); Neon backup branch `backup-pre-0009-2026-10-07` pending deletion                                                                                                           | S              |
| D9  | Netgsm SMS adapter written against assumed API                                                                                                                                                                                                                                                 | part of F2     |

---

## 5. Quality

### 5.1 Tests (326, all passing locally)

| File                                      | Tests | What it covers                                                                                                                            |
| ----------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/permissions.test.ts`                 | 64    | Every role × action, custom-role palette                                                                                                  |
| `server/production-safety.test.ts`        | 33    | Migrations 0008/0009 only add; SMS switch only "true"; Netgsm never delivers while off; templates contain no name/service; cron 401/503   |
| `domain/speech.test.ts`                   | 22    | Numbers, dates, times, phone grouping, titles in Turkish                                                                                  |
| `domain/availability.test.ts`             | 20    | Slots, hours, time off, lead time, horizon                                                                                                |
| `domain/notifications.test.ts`            | 18    | Idempotency, too_late, locks, single send, retries, unknown, window, caps, tenant isolation (incl. composite FK rejection), anonymisation |
| `domain/follow-ups.test.ts`               | 18    | Rules, plans, linking, reschedule, tenant isolation, KVKK, reminders                                                                      |
| `lib/phone.test.ts`                       | 17    | Turkish phone parsing/normalisation                                                                                                       |
| `voice/prompt.test.ts`                    | 15    | Prompt rules and variables                                                                                                                |
| `domain/appointments.integration.test.ts` | 15    | Booking, overlap guard, cancel, reschedule, idempotency, PATIENT_BUSY                                                                     |
| `domain/follow-up-logic.test.ts`          | 13    | Pure Takip calculations, month-end clamping                                                                                               |
| `retell/handlers.integration.test.ts`     | 12    | Signature, inbound tenant resolution, tool calls, events                                                                                  |
| `domain/panel.test.ts`                    | 12    | Lists, filters, practitioner scope, transitions, anonymisation, tenant isolation                                                          |
| `domain/settings.test.ts`                 | 9     | Hours overlap, tenant checks, assistant settings                                                                                          |
| `retell/agent-spec.test.ts`               | 8     | Agent/LLM spec generation                                                                                                                 |
| `auth/accounts.test.ts`                   | 8     | Account creation, sign-up closed, invitations, cross-clinic access                                                                        |
| `retell/sync.integration.test.ts`         | 6     | Create once, skip unchanged, partial progress, unreachable URL                                                                            |
| 10 smaller files                          | 32    | Contracts, schedule layout, console clinics, voices, test-call reachability, safe error logging, `cn`, retention                          |

**Not covered automatically:** UI and server actions (no E2E, no action-level tests), real voice conversations (only manual calls), real SIP/SMS providers, email delivery, load/concurrency beyond the DB constraint, accessibility and visual regressions. CI has never executed the tests (B1).

### 5.2 Security

- **In place:** invite-only accounts, server-side session and permission checks on every page/action, open-redirect protection, Retell webhook signatures (SDK `verify`, raw-body), constant-time cron secret, tenant resolved only on the server (session, number, agent id; never from the client or the LLM), security headers, secrets stored as Vercel "sensitive", `sslmode=verify-full` to the database, no impersonation, console without patient data, audit log.
- **Missing:** shared-store rate limiting (login, password reset, demo form, webhooks), CSP, dependency scanning, a formal security review, 2FA (out of scope by decision), monitoring/alerting.

### 5.3 KVKK

- **In place:** EU hosting for app and database (Vercel `fra1`, Neon Frankfurt), no personal data in logs or audit metadata, SMS texts without names or services, retention cron, Retell 30-day retention and signed recording URLs, deletion at Retell when recording is off, anonymisation incl. Retell audio, patient export, opt-out, consent per Takip plan, demo form consent.
- **Open:** all retention durations are working assumptions pending legal review; voice processing happens at Retell (sub-processor outside the EU database; cross-border transfer assessment needed); Resend stores staff emails in the US (no patient data); privacy notice, DPA template, sub-processor list, call-recording announcement wording to be reviewed by a lawyer; field-level encryption not assessed; VERBİS/registration questions for the company.

### 5.4 Performance and reliability risks

| Risk                                              | Likelihood                                    | Effect                    | Mitigation                                                 |
| ------------------------------------------------- | --------------------------------------------- | ------------------------- | ---------------------------------------------------------- |
| Voice turn latency above target (2 s+)            | High (measured on Sonnet; Haiku not measured) | Callers perceive slowness | F1.8 measurement, prompt length, Neon paid without suspend |
| Neon cold start during a call                     | Medium on free plan                           | First tool call slow      | Paid plan without auto-suspend                             |
| Missing reminders for late bookings               | Certain on Hobby                              | Fewer reminders           | Hourly job on Pro                                          |
| Silent failures (no monitoring, 1 h logs)         | Medium                                        | Problems discovered late  | Item 7                                                     |
| Single region, single provider for voice (Retell) | Low–medium                                    | Outage = no assistant     | Callback/forwarding plan in F2 (call routing)              |
| Unverified Netgsm APIs                            | Certain until F2                              | Integration surprises     | F2 testing                                                 |
| CI broken                                         | Certain                                       | Regressions can deploy    | Item 1–2                                                   |

---

## 6. Non-development blockers for going live (what is needed from the product team)

| #   | Blocker                      | Why it blocks                                                                                                                                                                                                                       | What I need from you                                                                                                               |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| N1  | **Company** (legal entity)   | Needed for contracts (Netgsm, providers), invoices, legal pages, SMS header, İYS                                                                                                                                                    | Company title (ünvan), address, tax/MERSİS numbers, a KVKK contact email                                                           |
| N2  | **Legal / KVKK review**      | Health data is special-category data; retention durations, privacy notice, DPA (clinic = controller, Recall = processor), sub-processors (Retell, Neon, Vercel, Resend, Netgsm), cross-border transfer, call-recording announcement | A lawyer's review and approved texts; decisions on retention durations                                                             |
| N3  | **İYS and SMS rules**        | Whether appointment and follow-up reminders count as transactional or commercial messages; consent and İYS registration                                                                                                             | Legal opinion; İYS registration if required                                                                                        |
| N4  | **Netgsm** (SIP trunk + SMS) | Real phone numbers and SMS (F2)                                                                                                                                                                                                     | Account opening (with company documents), number choice (0850 or geographic), SMS sender header approval; we do the setup together |
| N5  | **Plans and costs**          | Vercel Hobby is not for commercial use and limits crons/logs; Neon free suspends and has short history                                                                                                                              | Upgrade to Vercel Pro and a paid Neon plan before the first paying/pilot clinic; Retell billing/credit                             |
| N6  | **Domain and email**         | `recalltr.company` must not expire; emails land in spam                                                                                                                                                                             | Confirm auto-renew is on; mark Resend emails "not spam", keep tracking off; optionally decide on a `.com.tr` domain                |
| N7  | **Brand assets**             | Landing uses CSS placeholders                                                                                                                                                                                                       | Logo and hero visual                                                                                                               |
| N8  | **Pricing**                  | Landing shows packages without final prices                                                                                                                                                                                         | Pricing decision (after pilot per plan)                                                                                            |
| N9  | **Pilot clinics**            | F9 needs 3 clinics (≥ 1 dental, ≥ 1 aesthetic)                                                                                                                                                                                      | Recruit clinics; clinician-approved follow-up intervals for Takip examples                                                         |
| N10 | Open product question        | Who may listen to call recordings (currently owner + admin)                                                                                                                                                                         | Confirm or change                                                                                                                  |
| N11 | GitHub setting               | Branch protection for `main`                                                                                                                                                                                                        | Enable after CI is fixed                                                                                                           |
| N12 | Housekeeping                 | Neon backup branch `backup-pre-0009-2026-10-07`                                                                                                                                                                                     | Delete when comfortable                                                                                                            |

---

## 7. Recommended order for the remaining work

1. **Fix CI and protect `main` (items 1–2).** Cheapest, highest value: today nothing automatically stops a regression from deploying.
2. **Docs and config hygiene (item 3).** Another assistant will read these documents; stale status misleads planning.
3. **Route all SMS through the outbox (item 4).** Removes the only known path that would ignore opt-out; must precede any SMS enablement.
4. **Security hardening: rate limiting, CSP, dependency scan, security review (items 5, 6, 11).** Needed before real patients; independent of company/legal.
5. **Monitoring (item 7).** Before real calls; Hobby's 1-hour logs make incidents unrecoverable.
6. **Automated tests: server actions, then E2E (items 8–9).** Protects the panel before more features.
7. **Voice evaluation and latency (item 10).** The core product quality metric; decides model and settings; harness into the repo.
8. **Small items in parallel (14, 16, 17, 18, 13 when texts exist).**
9. **Plan upgrades (item 23) and Takip V1.1 hourly job (item 22).** As soon as a pilot date is known.
10. **F2 Netgsm (items 19–21).** Last, as decided, because it depends on company, legal/İYS and account opening; it also validates real-phone behaviour of the Retell agent.
11. **F9 pilot (item 24)**, then **F10** based on pilot results.

---

## 8. Overall development progress

### 8.1 Result

- **≈ 70 %** of the development needed to start a pilot (scope F0–F8 + Takip V0/V1, including the development side of F2).
- **≈ 49 %** if the pilot phase (F9) and post-pilot V1 features (F10) are also counted.
- Cross-check: the plan's checkboxes are 109 checked out of 153 (**71 %**), close to the weighted estimate (the checkbox count ignores effort differences and is partly stale).

### 8.2 How it was calculated

Each area gets a **weight** = its share of the total development effort (my estimate from what was built and what remains), and a **completion** = share of that area's work that is done and verified. Progress = Σ(weight × completion) / Σ weight.

| Area                                  | Weight  | Completion | Weighted  | Basis for completion                                                                                             |
| ------------------------------------- | ------- | ---------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| F0 Foundation                         | 5       | 100 %      | 5.00      | All items done                                                                                                   |
| F1 Voice core                         | 12      | 75 %       | 9.00      | F1.1–F1.7 done; F1.8 evaluation (scenarios, latency, model decision) not done                                    |
| F2 Telephony + SMS (development part) | 12      | 10 %       | 1.20      | Only the SMS adapter skeleton; outbox counted under Takip                                                        |
| F3 Accounts and roles                 | 8       | 90 %       | 7.20      | Features done; action-level tenant tests missing                                                                 |
| F4 Design and website                 | 6       | 85 %       | 5.10      | Missing logo/visuals, Lighthouse/accessibility pass, table sorting                                               |
| F5 Panel                              | 15      | 85 %       | 12.75     | All screens done; E2E, action tests, visual checks missing                                                       |
| F6 Console                            | 6       | 90 %       | 5.40      | Number import (F2) missing                                                                                       |
| F7 KVKK and security                  | 10      | 45 %       | 4.50      | Retention/anonymise/export done; rate limiting, CSP, encryption assessment, legal pages, security review missing |
| Takip V0 + V1                         | 10      | 95 %       | 9.50      | Done and in production; small polish only (V1.1 excluded)                                                        |
| F8 Production and ops                 | 8       | 65 %       | 5.20      | Live with domain, crons, headers; monitoring, green CI, `main` protection, preview environment missing           |
| **Total (pilot scope)**               | **92**  |            | **64.85** | 64.85 / 92 = **70.5 %**                                                                                          |
| F9 Pilot                              | 10      | 0 %        | 0         | Not started                                                                                                      |
| F10 V1 and later                      | 30      | 0 %        | 0         | Not started                                                                                                      |
| **Total (incl. F9, F10)**             | **132** |            | **64.85** | 64.85 / 132 = **49.1 %**                                                                                         |

Caveats: weights and completion percentages are judgement, not measurement; F2 may grow once real Netgsm behaviour is known; legal review may add work in F7 (texts, consent flows).
