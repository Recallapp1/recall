# Independent review guide

_For an outside reviewer (security, KVKK or code quality). 2026-10-12, after hardening round 2. English; product documents are Turkish._

## 1. Get the code

```bash
pnpm review:package
```

This writes `outputs/recall-review-<commit>.zip` (`git archive HEAD`: tracked files only, so no `.env.local`, no `node_modules`, no `outputs/`) and a secret-scan report next to it. Nothing is sent anywhere. To run it locally: `pnpm install`, then `pnpm test` (Vitest with an in-process PostgreSQL, PGlite; no external services) and `pnpm e2e` (Playwright against an in-memory database; builds the app).

## 2. What the system is

Recall answers phone calls for clinics (dental, health, beauty) with a Turkish voice assistant and gives each clinic a web panel for appointments, calls and patients. One code base, many clinics (multi-tenant).

| Part            | Technology                                                           | Where                                                      |
| --------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| Web app and API | Next.js 16 (App Router), React 19, TypeScript strict                 | `src/app`                                                  |
| Business rules  | Pure functions with tests                                            | `src/server/domain`                                        |
| Database        | PostgreSQL on Neon, Drizzle ORM, migrations in `drizzle/`            | `src/server/db/schema.ts`                                  |
| Panel accounts  | Better Auth (organisation plugin = clinic), roles in one file        | `src/server/auth`, `src/lib/permissions.ts`                |
| Voice           | Retell AI (agent per clinic), LLM Claude 4.5 Haiku, ElevenLabs voice | `src/server/voice`, Retell code only in `providers/retell` |
| Hosting         | Vercel (`fra1`), two daily cron jobs                                 | `vercel.json`                                              |
| E-mail / SMS    | Resend / Netgsm (SMS off everywhere)                                 | `src/server/notifications`                                 |

## 3. Trust boundaries

| Boundary                                                       | What crosses                                                       | How it is checked                                                                                                                                              | Look at                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Retell → webhooks (`/api/voice/retell/{inbound,tools,events}`) | Call metadata, tool calls with model-chosen arguments, transcripts | HMAC signature on the raw body before parsing; Zod schemas; replay guard for tool calls; clinic resolved from the agent id on the server, never from arguments | `handlers.ts` (`readVerified`, `resolveClinic`)                         |
| LLM → tools                                                    | Arguments the model invents                                        | Zod per tool; no clinic id accepted from arguments; ownership checks (caller ID or name + date + time); per-call caps                                          | `src/server/voice/tools/`                                               |
| Browser → panel                                                | Server Actions and pages                                           | Session required; every action starts with `requireClinic`/`requirePermission`; every query filtered by `clinicId`; Next.js origin check on actions            | `src/server/auth/session.ts`, `src/app/panel/**/actions.ts`             |
| Browser → Better Auth (`/api/auth/*`)                          | Sign-in, reset, invitation                                         | Only an allowlist of endpoints is served; the rest 404 and are audited; limits in Postgres                                                                     | `src/server/auth/http-surface.ts`, `src/server/security/rate-limits.ts` |
| Vercel Cron → `/api/cron/*`                                    | Job trigger                                                        | `Authorization: Bearer CRON_SECRET`, constant-time compare; 503 without a secret                                                                               | `src/server/cron-auth.ts`                                               |
| App → Retell API                                               | Agent sync, recording links, deletions                             | Server key; recording links fetched per playback for the authorised call only                                                                                  | `providers/retell`, `recording-access.ts`                               |
| Recall team → console (`/admin`)                               | Clinic setup                                                       | Platform admin role only                                                                                                                                       | `src/server/auth/platform.ts`                                           |

## 4. Personal and health data flows

- **In:** caller number (caller ID or spoken), name, chosen service and time (health-related), transcript and summary, optional recording (stays on Retell, we store a marker), callback notes (free text).
- **At rest:** Neon (Frankfurt). Retention job: recordings 30 days, transcripts 90, caller number 730, callback notes 90, notification log 365 (`retention.ts`). No period yet for summaries, demo requests and audit events (open risk 12).
- **Out:** Retell and its sub-processors (USA), Resend (staff e-mail only), Sentry (off; events masked), Netgsm (off).
- **KVKK:** export (`exportPatientData`), erasure (`anonymizePatient`, with a Retell deletion queue), correction (`updatePatientIdentity`, switch `PANEL_PATIENT_EDIT`), SMS opt-out. Logs carry no names, numbers or transcripts (`safeError`, tests in `kvkk-end-to-end.integration.test.ts`, `fallbacks.test.ts`).

## 5. Where to look first

1. `src/server/voice/providers/retell/handlers.ts`: the only unauthenticated-by-session entry for voice; signature, tenant resolution, idempotency, late events after erasure.
2. `src/server/voice/tools/caller.ts`: who may see or change an appointment by phone (caller ID trust, shared numbers, lockouts).
3. `src/server/domain/panel.ts`: panel read models, erasure, export and the shared-number scoping.
4. `src/server/auth/` and `src/lib/permissions.ts`: roles, invitations, custom roles, the closed Better Auth surface.
5. `src/server/production-safety.test.ts`: release guards (add-only migrations, single SMS path, cron auth, pinned workflow, docs drift, the P-12 index guard).
6. `src/server/voice/prompt.ts`: baseline rules (variant `full`) and the switched-off variants.

## 6. Known risks and decisions

- `docs/OPEN-RISKS-BEFORE-PILOT.md`: every accepted and open risk with evidence.
- `docs/DECISIONS-TO-REVIEW.md`: each decision made without the owner, with how to change it.
- `docs/reviews/PRELAUNCH-AUDIT-2026-10-08.md` and `GAP-REVIEW-2026-10-10.md`: earlier findings and their fix status.
- `docs/NEXT-STEPS-FOR-OWNER.md` → Switches: everything built but off.

## 7. What only a real call can show

Signature of real Retell webhooks with the current key, what a caller hears on a database or LLM failure, latency, how well the assistant follows the prompt in Turkish speech, and the shared-number questions in practice. The evaluation harness (`pnpm voice:eval --plan`) prints the planned calls and their cost without placing any.
