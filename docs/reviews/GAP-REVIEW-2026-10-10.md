# Gap review for a paying pilot clinic (hardening round 2)

_Read-only review of `main` at `d15ce70` (2026-10-11), written before any round 2 code change. Owner-facing, in English like the other review documents. Severity is the risk for **one paying pilot clinic**: **High** = fix before the pilot; **Medium** = fix or accept knowingly before the pilot; **Low** = later._

Earlier findings (`PRELAUNCH-AUDIT-2026-10-08.md`, F-01…F-20, P-01…P-27) are not repeated unless their state changed. "Covered" means the code was inspected and the behaviour exists with tests.

## Summary

| #    | Area                                                                                                   | Severity | Triage                            |
| ---- | ------------------------------------------------------------------------------------------------------ | -------- | --------------------------------- |
| G-01 | Late or replayed call events re-fill an erased call (transcript, summary, recording)                   | **High** | Phase 3, fix on (KVKK bug)        |
| G-02 | No way to correct a patient's name or number (KVKK m.11 correction)                                    | **High** | Phase 3, behind a switch          |
| G-03 | A tool request that fails before the tool runs (database down) returns HTTP 500 with no honest message | **High** | Phase 3, behind a switch          |
| G-04 | No second factor for panel accounts (= P-18)                                                           | Medium   | OPEN-RISKS (needs migration + UI) |
| G-05 | Seven-day sessions on shared reception computers; no shorter option                                    | Medium   | Extra batch, behind a switch      |
| G-06 | `"+90 0532 …"` normalises to a wrong 13-digit number (= P-22, still open)                              | Medium   | Extra batch, fix on (bug)         |
| G-07 | `%` and `_` in panel search act as wildcards (= P-23, still open)                                      | Low      | Extra batch, fix on (bug)         |
| G-08 | No retention period for call summaries, demo requests and audit events                                 | Medium   | OPEN-RISKS (lawyer decides)       |
| G-09 | Inbound webhook when the database is down: what Retell does is unverified                              | Medium   | OPEN-RISKS (needs a real call)    |
| G-10 | Daily voice-minute budget counts finished calls only                                                   | Low      | OPEN-RISKS                        |
| G-11 | Two callback requests from one call for one number merge into one                                      | Low      | Phase 2c                          |
| G-12 | Panel bookings never store who they were for                                                           | Low      | Phase 2b                          |
| G-13 | Erasure note on the patient page says "calls from this number"                                         | Low      | Phase 2a                          |
| G-14 | `pnpm audit`: 1 moderate (esbuild via a dev-time chain, = P-24)                                        | Low      | Recorded per batch                |

No critical finding.

## 1. Panel authentication

| Topic             | State                                                                                                                                                                                                                                                                                                                   | Severity |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2FA               | **Missing** (G-04). Better Auth `twoFactor` needs a new table and user column (add-only migration), enrolment and login screens, backup codes and a recovery path. Effort 2–3 days. Health data justifies it before general sales; for one pilot clinic with a few named staff accounts it can be accepted knowingly.   | Medium   |
| Session lifetime  | `src/server/auth/index.ts:31,68-71`: 7 days, refreshed daily. "Beni hatırla" off gives a browser-session cookie, but the server session still lives 7 days. A reception PC shared between shifts stays signed in (G-05). Proposed: `PANEL_SESSION_HOURS` switch (unset = 7 days). Effort 0.5 day.                       | Medium   |
| Password reset    | Covered: 24 h single-use token (`index.ts:33,74`), all sessions revoked on reset (`:75`), one neutral message whether or not the address exists (`src/app/(auth)/actions.ts:115`), limits per IP and address (`src/server/security/rate-limits.ts:24-25`).                                                              | —        |
| Login rate limits | Covered: per IP (20/10 min) and per account (10/15 min) in Postgres, shared by every instance (`rate-limits.ts:21-22`, `(auth)/actions.ts:52-55`); one message for wrong e-mail or password (`:68-70`). Better Auth HTTP endpoints outside an allowlist answer 404 and are audited (`src/server/auth/http-surface.ts`). | —        |

## 2. What a caller hears when something fails (baseline prompt)

- **A tool throws inside the tool:** covered. `src/server/voice/tools/index.ts:74-97` returns `ok: false, INTERNAL_ERROR` with "suggest a callback note"; the baseline rules forbid announcing a result without `ok: true` (`src/server/voice/prompt.ts` full rules, "Bir işlemi, tool sonucu ok: true dönmeden asla "yapıldı" diye bildirme").
- **The database fails before the tool runs (G-03, High):** `handleFunctionCall` reads the clinic and upserts the call first (`src/server/voice/providers/retell/handlers.ts:117-160`); an error there escapes as HTTP 500. Retell then hands the model an error string that the baseline prompt has no rule for (the explicit "INTERNAL_ERROR / no answer" rule exists only in the hardened variant, A9, off). The model is still barred from claiming success, but may improvise. **Fix:** `VOICE_TOOL_FAILSAFE` (off): catch these errors and answer `ok: false, INTERNAL_ERROR` with the same honest message; unset keeps today's HTTP 500. Effort 0.5 day.
- **The LLM fails or times out:** inside Retell; nothing in our code. Retell's own fallback (silence, then the call ends after 20 s of silence: `end_call_after_silence_ms`). Only a real call can show what the caller hears.
- **The inbound webhook fails (G-09):** if the database is down, `handleInbound` throws (no `reject`). Whether Retell then connects the number's agent without call variables or drops the call is not documented in our files; only a real call can tell. The agent spec cannot be changed in this round.

## 3. Duplicate, late and out-of-order Retell events

- Covered: signature checked before parsing (`handlers.ts:320-328`); byte-identical tool replays answered without running again (`:124-145`); mutating tools idempotent by natural key and, with `VOICE_TOOL_IDEMPOTENCY`, by request key; `completeCall` only writes fields that are present, so `call_ended` after `call_analyzed` loses nothing (`src/server/domain/calls.ts:99-115`); outcome priority guard; tests `handlers.integration.test.ts:750,845,563`.
- **G-01 (High):** a `call_ended` / `call_analyzed` that arrives **after a KVKK erasure** (a Retell retry, a late analysis, a replay inside the five-minute signature window) writes the transcript, summary and recording link back onto the erased call (`calls.ts:105-107`; `handlers.ts:251-262`), and post-call flags would run on it. **Fix (on, bug fix):** the erasure marks the call's provider-deletion row as `patient_anonymized` (one row per call, kept with `done_at`); events for such a call store no content and run no flags. No migration. Effort 0.5 day.

## 4. Calendar edge cases

Covered: lunch breaks as split ranges, practitioner hours ∩ clinic hours, clinic-wide closures and practitioner leave (`time_off`, `src/server/domain/scheduling.ts:179-192`), adding leave over existing appointments reports the conflicts (`settings.ts:406-440`), minimum notice, booking window, Istanbul without DST and a DST zone, midnight boundary (`time-edges.test.ts`), same-slot race (database exclusion constraint + `booking under concurrency` test). Phase 4b/4c add more race and edge tests.

## 5. Retention

`src/server/domain/retention.ts:17-33`: recordings 30 days (Retell deletes audio), transcripts 90, caller number 730, notification log 365, closed follow-ups 730, callback notes 90, job runs 90, tool requests 30. **G-08 (Medium):** call summaries, demo requests (prospect name, e-mail, phone) and audit events have no period. Summaries can describe symptoms. Periods are a legal decision (lawyer brief Q12): listed for the owner, not invented here.

## 6. Panel security

| Topic            | State                                                                                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSRF             | Covered: every state change is a Server Action (Next.js compares `Origin` with the host) or a Better Auth endpoint with `trustedOrigins` (`index.ts:46`); the only panel route handler is the GET export. Phase 4g adds a test.                                  |
| Session fixation | Covered by Better Auth: a new session token on every sign-in; password reset revokes all sessions.                                                                                                                                                               |
| Role escalation  | Covered: only owners grant or change owners (`ayarlar/ekip/actions.ts:29-38,158-164`), last owner protected, custom roles cannot carry team, billing or organisation rights (`src/lib/contracts/team.ts`, test `team.test.ts:19`), exhaustive role matrix (A10). |
| Invitations      | Covered: 7 days, pending only, row locked and marked accepted in one transaction (`src/server/auth/accounts.ts:167-220`), re-invite cancels the old one.                                                                                                         |
| User enumeration | Covered for sign-in and reset (one message). The invitation page reveals that an invitation id exists, but ids are random UUIDs and the page is rate-limited (`invitationIp`).                                                                                   |

## 7. Rate limits, abuse caps, per-caller cost

Covered and enforced where the panel says: inbound admission per number, hidden numbers, clinic per hour and daily voice minutes (`src/server/domain/voice-limits.ts`), max call length in the agent spec, bookings per call, tool calls per call, callback notes per call and number, verification lockouts, test calls per user and clinic. The Sınırlar page (A8, off) reads the same `settings.limits`. **G-10 (Low):** the daily minute budget sums finished calls, so calls in progress at the limit can overrun it by their length.

## 8. KVKK end to end

- **G-02 (High), correction:** staff can change notes, SMS opt-out and erase, but **cannot correct a patient's name or phone** (`src/app/panel/(app)/hastalar/actions.ts` has no such action). KVKK m.11 gives the right to correction. **Fix:** `PANEL_PATIENT_EDIT` (off): owners, admins and staff with `patients.update` edit name and phone, audited without values; a phone already used by another patient is refused while the unique index exists. Effort 1 day.
- Objection: by phone or e-mail to the clinic (SUPPORT-PROCESS.md); SMS opt-out in the panel; recording objection only in the hardened prompt (off). Legal wording: lawyer brief Q6.
- Retention auto-delete: covered by the daily job (see 5); Phase 4i adds a verification test across tables.
- Personal data in logs: covered by `safeError`, masked Sentry events and CI annotations, audit metadata holds field names only (`hastalar/actions.ts:43`).

## 9. Data integrity

- Orphans: composite tenant foreign keys with cascade or set-null everywhere a patient is referenced; calls are not linked by key (by design). Phase 4j adds an orphan scan test after erasure.
- Phone normalisation: caller numbers are normalised on write (`calls.ts:29`); **G-06:** `"+90 0532 123 45 67"` → `+9005321234567` (`src/lib/phone.ts:14-16`), so such a number never matches its patient. Fix on (bug fix; old values are not rewritten).
- **G-07:** search passes `%` and `_` through to `ILIKE` (`src/server/domain/panel.ts:249-251,684-685`): over-matching, no injection.

## 10. Anything else that would block a pilot

Not in code: a phone line (P-06), the lawyer's review (P-07), Neon backups on a paid plan (P-05), Vercel Pro (commercial use), Retell credit and the evaluation. These remain in NEXT-STEPS-FOR-OWNER.md.

## Triage

- **Phase 3 (fix now):** G-01, G-02, G-03.
- **Extra batches after Phase 6:** G-05, G-06, G-07.
- **Phase 2:** G-11, G-12, G-13.
- **OPEN-RISKS-BEFORE-PILOT.md:** G-04, G-08, G-09, G-10, G-14.
