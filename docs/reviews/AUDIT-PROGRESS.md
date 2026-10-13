# Full audit: progress and coverage ledger

> Checkpoint for [FULL-AUDIT-2026-10-13.md](FULL-AUDIT-2026-10-13.md). **Current phase:** Done (reports written; resume point: none)

## Totals

| Status   | Files | Lines |
| -------- | ----- | ----- |
| read     | 174   | 17471 |
| skimmed  | 59    | 9619  |
| not read | 263   | 29629 |

Tracked files in scope: 496 (lockfile, images, fonts, audio and drizzle snapshot JSON excluded). Line counts from the working tree at `5a91b97`.

"Read fully" means every line was read in this audit. "Skimmed" means opened and scanned (structure, key functions, grep hits) but not read line by line. "Not read" means not opened in this audit.

## Ledger

| Path                                                                       | Lines | Read     | Verdict                          |
| -------------------------------------------------------------------------- | ----: | -------- | -------------------------------- |
| `.claude/launch.json`                                                      |    11 | not read |                                  |
| `.editorconfig`                                                            |    12 | not read |                                  |
| `.env.example`                                                             |   102 | not read |                                  |
| `.gitattributes`                                                           |     4 | not read |                                  |
| `.github/dependabot.yml`                                                   |    15 | read     |                                  |
| `.github/workflows/ci.yml`                                                 |    84 | read     |                                  |
| `.gitignore`                                                               |    57 | not read |                                  |
| `.nvmrc`                                                                   |     1 | not read |                                  |
| `.prettierignore`                                                          |     6 | not read |                                  |
| `.prettierrc.json`                                                         |     8 | not read |                                  |
| `AGENTS.md`                                                                |     9 | read     |                                  |
| `CHANGELOG.md`                                                             |    27 | read     |                                  |
| `CLAUDE.md`                                                                |   111 | read     |                                  |
| `DESIGN.md`                                                                |   159 | skimmed  |                                  |
| `README.md`                                                                |    39 | read     |                                  |
| `WORKLOG.md`                                                               |   924 | skimmed  |                                  |
| `components.json`                                                          |    25 | not read |                                  |
| `docker-compose.yml`                                                       |    21 | not read |                                  |
| `docs/00-product/PRD.md`                                                   |    83 | read     |                                  |
| `docs/00-product/PRICING.md`                                               |    41 | read     |                                  |
| `docs/00-product/ROADMAP.md`                                               |    26 | read     |                                  |
| `docs/00-product/USER-FLOWS.md`                                            |    81 | read     |                                  |
| `docs/00-product/USER-PERSONAS.md`                                         |    48 | read     |                                  |
| `docs/01-architecture/API.md`                                              |   112 | read     |                                  |
| `docs/01-architecture/ARCHITECTURE.md`                                     |   144 | read     |                                  |
| `docs/01-architecture/DATA-MODEL.md`                                       |   162 | read     |                                  |
| `docs/01-architecture/MULTI-TENANCY.md`                                    |    39 | read     |                                  |
| `docs/01-architecture/TECH-STACK.md`                                       |    59 | read     |                                  |
| `docs/02-voice-agent/AGENT-DESIGN.md`                                      |    81 | read     |                                  |
| `docs/02-voice-agent/CLINIC-CONFIG-SCHEMA.md`                              |   106 | read     |                                  |
| `docs/02-voice-agent/CONVERSATION-SCENARIOS.md`                            |   108 | read     |                                  |
| `docs/02-voice-agent/ESCALATION.md`                                        |    60 | read     |                                  |
| `docs/02-voice-agent/RETELL-SETUP.md`                                      |   197 | skimmed  |                                  |
| `docs/02-voice-agent/SYSTEM-PROMPT.md`                                     |   107 | read     |                                  |
| `docs/02-voice-agent/TOOLS.md`                                             |   143 | read     |                                  |
| `docs/02-voice-agent/VOICE-AND-LANGUAGE.md`                                |    59 | read     |                                  |
| `docs/02-voice-agent/VOICE-EVAL.md`                                        |    92 | read     |                                  |
| `docs/03-telephony/CALL-ROUTING.md`                                        |    39 | read     |                                  |
| `docs/03-telephony/NOTIFICATIONS.md`                                       |    60 | read     |                                  |
| `docs/03-telephony/TELEPHONY.md`                                           |    49 | read     |                                  |
| `docs/04-panel/DESIGN-SYSTEM.md`                                           |   134 | skimmed  |                                  |
| `docs/04-panel/INTEGRATIONS.md`                                            |    34 | read     |                                  |
| `docs/04-panel/ONBOARDING.md`                                              |    45 | read     |                                  |
| `docs/04-panel/PANEL-SPEC.md`                                              |    67 | read     |                                  |
| `docs/05-compliance/AUDIT-POLICY.md`                                       |    22 | read     |                                  |
| `docs/05-compliance/DATA-RETENTION.md`                                     |    38 | read     |                                  |
| `docs/05-compliance/KVKK.md`                                               |    77 | read     |                                  |
| `docs/05-compliance/SECURITY-REVIEW-2026-10.md`                            |    47 | read     |                                  |
| `docs/05-compliance/SECURITY.md`                                           |    58 | read     |                                  |
| `docs/06-operations/BACKUP-RESTORE.md`                                     |    68 | read     |                                  |
| `docs/06-operations/COST-MODEL.md`                                         |    81 | read     |                                  |
| `docs/06-operations/DEPLOYMENT.md`                                         |   150 | read     |                                  |
| `docs/06-operations/DOMAIN-MIGRATION.md`                                   |    31 | read     |                                  |
| `docs/06-operations/INCIDENT-RESPONSE.md`                                  |    96 | read     |                                  |
| `docs/06-operations/LOCAL-DEVELOPMENT.md`                                  |    81 | read     |                                  |
| `docs/06-operations/MONITORING.md`                                         |   116 | read     |                                  |
| `docs/06-operations/SECRET-ROTATION-2026-10.md`                            |   113 | read     |                                  |
| `docs/06-operations/SUPPORT-PROCESS.md`                                    |    49 | read     |                                  |
| `docs/06-operations/TESTING.md`                                            |    47 | read     |                                  |
| `docs/07-sales/CLINIC-ONBOARDING.md`                                       |   101 | read     |                                  |
| `docs/07-sales/PHONE-LINE-OPTIONS.md`                                      |    63 | skimmed  |                                  |
| `docs/DECISIONS-TO-REVIEW.md`                                              |   144 | skimmed  |                                  |
| `docs/HARDENING-2026-10.md`                                                |    61 | skimmed  |                                  |
| `docs/IMPLEMENTATION-PLAN.md`                                              |   430 | skimmed  |                                  |
| `docs/NEXT-STEPS-FOR-OWNER.md`                                             |    94 | read     |                                  |
| `docs/OPEN-RISKS-BEFORE-PILOT.md`                                          |    54 | read     |                                  |
| `docs/STATUS-REPORT-2026-10-07.md`                                         |   411 | skimmed  |                                  |
| `docs/decisions/ADR-001-stack.md`                                          |    36 | read     |                                  |
| `docs/decisions/ADR-002-voice-platform.md`                                 |    30 | read     |                                  |
| `docs/decisions/ADR-003-llm-model.md`                                      |   132 | read     |                                  |
| `docs/decisions/ADR-004-retell-voice-platform.md`                          |    59 | read     |                                  |
| `docs/decisions/ADR-005-design-system.md`                                  |    27 | read     |                                  |
| `docs/decisions/ADR-006-email-provider.md`                                 |    41 | read     |                                  |
| `docs/decisions/ADR-007-navy-palette-and-landing.md`                       |    36 | read     |                                  |
| `docs/decisions/ADR-008-shadcn-theming.md`                                 |    30 | read     |                                  |
| `docs/decisions/ADR-009-accounts-and-roles.md`                             |    29 | read     |                                  |
| `docs/decisions/ADR-010-platform-console.md`                               |    26 | read     |                                  |
| `docs/decisions/ADR-011-caller-identity.md`                                |    40 | read     |                                  |
| `docs/decisions/README.md`                                                 |    19 | read     |                                  |
| `docs/decisions/TEMPLATE.md`                                               |    24 | read     |                                  |
| `docs/legal-drafts/DATA-FLOW.md`                                           |    47 | read     |                                  |
| `docs/legal-drafts/DPA-OUTLINE.md`                                         |    21 | read     |                                  |
| `docs/legal-drafts/GIZLILIK-POLITIKASI.md`                                 |    37 | read     |                                  |
| `docs/legal-drafts/KULLANIM-KOSULLARI.md`                                  |    47 | read     |                                  |
| `docs/legal-drafts/KVKK-AYDINLATMA-METNI.md`                               |    52 | read     |                                  |
| `docs/legal-drafts/LAWYER-BRIEF.md`                                        |    72 | read     |                                  |
| `docs/legal-drafts/README.md`                                              |    13 | read     |                                  |
| `docs/legal-drafts/RECORDING-NOTICE-SCRIPT.md`                             |    22 | read     |                                  |
| `docs/proposals/TAKIP.md`                                                  |   457 | skimmed  |                                  |
| `docs/reviews/GAP-REVIEW-2026-10-10.md`                                    |    93 | read     |                                  |
| `docs/reviews/INDEPENDENT-REVIEW-GUIDE.md`                                 |    64 | read     |                                  |
| `docs/reviews/PRELAUNCH-AUDIT-2026-10-08.md`                               |   456 | skimmed  |                                  |
| `drizzle.config.ts`                                                        |    14 | read     |                                  |
| `drizzle/0000_init.sql`                                                    |   163 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0001_appointment_overlap_guard.sql`                               |    12 | read     |                                  |
| `drizzle/0002_voice_agents_and_phone_numbers.sql`                          |    37 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0003_demo_requests.sql`                                           |    13 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0004_accounts.sql`                                                |   107 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0005_audit_events.sql`                                            |    14 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0006_member_preferences.sql`                                      |    10 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0007_platform_admin.sql`                                          |     7 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0008_notifications.sql`                                           |    43 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0009_follow_ups.sql`                                              |    92 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0010_rate_limits.sql`                                             |     7 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0011_transactional_sms.sql`                                       |     3 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0012_callback_dedupe.sql`                                         |     2 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0013_tenant_foreign_keys.sql`                                     |    45 | read     | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0014_job_runs.sql`                                                |    25 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0015_call_patients_provider_deletions.sql`                        |    32 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0016_call_flags.sql`                                              |     2 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0017_appointment_booked_for.sql`                                  |     1 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0018_tool_requests.sql`                                           |    15 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/0019_two_factor.sql`                                              |    15 | read     | scanned for DROP/UPDATE/NOT NULL |
| `drizzle/meta/_journal.json`                                               |   146 | skimmed  | scanned for DROP/UPDATE/NOT NULL |
| `e2e/a11y.spec.ts`                                                         |    51 | not read |                                  |
| `e2e/auth.setup.ts`                                                        |    15 | not read |                                  |
| `e2e/fixtures.ts`                                                          |    23 | not read |                                  |
| `e2e/mobile.spec.ts`                                                       |    70 | not read |                                  |
| `e2e/panel.spec.ts`                                                        |   146 | not read |                                  |
| `eslint.config.mjs`                                                        |    18 | not read |                                  |
| `next.config.ts`                                                           |    43 | read     |                                  |
| `package.json`                                                             |    92 | skimmed  |                                  |
| `playwright.config.ts`                                                     |    60 | not read |                                  |
| `pnpm-workspace.yaml`                                                      |     4 | not read |                                  |
| `postcss.config.mjs`                                                       |     7 | not read |                                  |
| `scripts/check-design-tokens.ts`                                           |    57 | skimmed  |                                  |
| `scripts/ci-wait.ts`                                                       |   102 | skimmed  |                                  |
| `scripts/clinic-member.ts`                                                 |    53 | skimmed  |                                  |
| `scripts/db-export.ts`                                                     |    52 | read     |                                  |
| `scripts/db-restore-verify.ts`                                             |   129 | skimmed  |                                  |
| `scripts/dev-tunnel.ts`                                                    |   140 | skimmed  |                                  |
| `scripts/e2e-db.ts`                                                        |   185 | skimmed  |                                  |
| `scripts/fixtures/retell-call-ended.json`                                  |    16 | skimmed  |                                  |
| `scripts/fixtures/retell-function-call.json`                               |    11 | skimmed  |                                  |
| `scripts/fixtures/retell-inbound.json`                                     |     8 | skimmed  |                                  |
| `scripts/local-db.ts`                                                      |    73 | skimmed  |                                  |
| `scripts/platform-admin.ts`                                                |    38 | skimmed  |                                  |
| `scripts/redact-log.mjs`                                                   |    37 | skimmed  |                                  |
| `scripts/rehearsal/p12-dev-rehearsal.ts`                                   |   253 | skimmed  |                                  |
| `scripts/rehearsal/p12-tests.ts`                                           |    13 | skimmed  |                                  |
| `scripts/retell-send.ts`                                                   |    73 | skimmed  |                                  |
| `scripts/secret-scan.ts`                                                   |    69 | skimmed  |                                  |
| `scripts/voice-eval/budget.ts`                                             |    23 | skimmed  |                                  |
| `scripts/voice-eval/profiles.ts`                                           |    86 | skimmed  |                                  |
| `scripts/voice-eval/run.ts`                                                |   561 | skimmed  |                                  |
| `scripts/voice-eval/scenarios.ts`                                          |   542 | skimmed  |                                  |
| `scripts/voice-eval/tts.ps1`                                               |    19 | skimmed  |                                  |
| `scripts/voice-sync.ts`                                                    |    97 | read     |                                  |
| `scripts/voice-voices.ts`                                                  |    39 | skimmed  |                                  |
| `src/app/(auth)/_components/auth-ui.tsx`                                   |    40 | not read |                                  |
| `src/app/(auth)/actions.ts`                                                |   228 | read     |                                  |
| `src/app/(auth)/davet/[id]/invitation-forms.tsx`                           |    58 | not read |                                  |
| `src/app/(auth)/davet/[id]/page.tsx`                                       |    94 | not read |                                  |
| `src/app/(auth)/giris/dogrulama/code-form.tsx`                             |    69 | not read |                                  |
| `src/app/(auth)/giris/dogrulama/page.tsx`                                  |    32 | not read |                                  |
| `src/app/(auth)/giris/page.tsx`                                            |    26 | not read |                                  |
| `src/app/(auth)/giris/sign-in-form.tsx`                                    |    60 | not read |                                  |
| `src/app/(auth)/iki-adim/page.tsx`                                         |    37 | not read |                                  |
| `src/app/(auth)/iki-adim/two-factor-ui.tsx`                                |   235 | not read |                                  |
| `src/app/(auth)/layout.tsx`                                                |    60 | not read |                                  |
| `src/app/(auth)/sifre-belirle/page.tsx`                                    |    35 | not read |                                  |
| `src/app/(auth)/sifre-belirle/set-password-form.tsx`                       |    47 | not read |                                  |
| `src/app/(auth)/sifremi-unuttum/forgot-password-form.tsx`                  |    45 | not read |                                  |
| `src/app/(auth)/sifremi-unuttum/page.tsx`                                  |    18 | not read |                                  |
| `src/app/(auth)/two-factor-actions.ts`                                     |   218 | read     |                                  |
| `src/app/(marketing)/_components/contact.tsx`                              |    46 | not read |                                  |
| `src/app/(marketing)/_components/demo-form.tsx`                            |   172 | not read |                                  |
| `src/app/(marketing)/_components/header-surface.tsx`                       |    76 | not read |                                  |
| `src/app/(marketing)/_components/hero.tsx`                                 |   121 | not read |                                  |
| `src/app/(marketing)/_components/overview.tsx`                             |   134 | not read |                                  |
| `src/app/(marketing)/_components/product.tsx`                              |   168 | not read |                                  |
| `src/app/(marketing)/_components/section-header.tsx`                       |    45 | not read |                                  |
| `src/app/(marketing)/_components/site-footer.tsx`                          |    43 | not read |                                  |
| `src/app/(marketing)/_components/site-header.tsx`                          |    66 | not read |                                  |
| `src/app/(marketing)/_components/trust.tsx`                                |   176 | not read |                                  |
| `src/app/(marketing)/_content.ts`                                          |   283 | not read |                                  |
| `src/app/(marketing)/actions.ts`                                           |    80 | not read |                                  |
| `src/app/(marketing)/layout.tsx`                                           |    13 | not read |                                  |
| `src/app/(marketing)/page.tsx`                                             |    24 | not read |                                  |
| `src/app/admin/_components/console-nav.tsx`                                |    60 | not read |                                  |
| `src/app/admin/actions.ts`                                                 |   330 | read     |                                  |
| `src/app/admin/demo-talepleri/demo-status-select.tsx`                      |    31 | not read |                                  |
| `src/app/admin/demo-talepleri/page.tsx`                                    |    81 | not read | auth guard present (grep)        |
| `src/app/admin/klinikler/[id]/clinic-actions.tsx`                          |   291 | not read |                                  |
| `src/app/admin/klinikler/[id]/page.tsx`                                    |   240 | not read | auth guard present (grep)        |
| `src/app/admin/klinikler/yeni/new-clinic-form.tsx`                         |   134 | not read |                                  |
| `src/app/admin/klinikler/yeni/page.tsx`                                    |    21 | not read | auth guard present (grep)        |
| `src/app/admin/layout.tsx`                                                 |    60 | not read |                                  |
| `src/app/admin/page.tsx`                                                   |   148 | not read |                                  |
| `src/app/api/auth/[...all]/route.ts`                                       |    26 | read     |                                  |
| `src/app/api/cron/notifications/route.ts`                                  |    77 | read     |                                  |
| `src/app/api/cron/provider-deletions/route.ts`                             |    35 | read     |                                  |
| `src/app/api/cron/reminders/route.ts`                                      |    53 | read     |                                  |
| `src/app/api/cron/retention/route.ts`                                      |    38 | read     |                                  |
| `src/app/api/health/jobs/route.test.ts`                                    |    54 | read     |                                  |
| `src/app/api/health/jobs/route.ts`                                         |    34 | read     |                                  |
| `src/app/api/health/route.ts`                                              |    17 | read     |                                  |
| `src/app/api/voice/retell/events/route.ts`                                 |     4 | read     |                                  |
| `src/app/api/voice/retell/inbound/route.ts`                                |     4 | read     |                                  |
| `src/app/api/voice/retell/tools/route.ts`                                  |     4 | read     |                                  |
| `src/app/dev/tasarim/page.tsx`                                             |   136 | not read |                                  |
| `src/app/dev/tasarim/panel-showcase.tsx`                                   |   480 | not read |                                  |
| `src/app/forbidden.tsx`                                                    |    24 | not read |                                  |
| `src/app/globals.css`                                                      |   257 | not read |                                  |
| `src/app/layout.tsx`                                                       |    40 | not read |                                  |
| `src/app/not-found.tsx`                                                    |    30 | not read |                                  |
| `src/app/opengraph-image.alt.txt`                                          |     1 | not read |                                  |
| `src/app/panel/(app)/_components/account-menus.tsx`                        |   154 | not read |                                  |
| `src/app/panel/(app)/_components/panel-nav.tsx`                            |   114 | not read |                                  |
| `src/app/panel/(app)/_nav.ts`                                              |    82 | not read |                                  |
| `src/app/panel/(app)/aramalar/[id]/call-report.tsx`                        |    93 | not read |                                  |
| `src/app/panel/(app)/aramalar/[id]/page.tsx`                               |   163 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/aramalar/[id]/test-call-toggle.tsx`                   |    33 | not read |                                  |
| `src/app/panel/(app)/aramalar/actions.ts`                                  |   123 | read     |                                  |
| `src/app/panel/(app)/aramalar/page.tsx`                                    |   177 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/aramalar/recording-player.tsx`                        |    46 | not read |                                  |
| `src/app/panel/(app)/ayarlar/_components/settings-ui.tsx`                  |   178 | not read |                                  |
| `src/app/panel/(app)/ayarlar/actions.ts`                                   |   314 | read     |                                  |
| `src/app/panel/(app)/ayarlar/asistan/assistant-form.tsx`                   |   220 | not read |                                  |
| `src/app/panel/(app)/ayarlar/asistan/page.tsx`                             |   100 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/ayarlar/asistan/test-call.tsx`                        |   141 | not read |                                  |
| `src/app/panel/(app)/ayarlar/asistan/voice-picker.tsx`                     |   187 | not read |                                  |
| `src/app/panel/(app)/ayarlar/calisma-saatleri/clinic-hours-form.tsx`       |    32 | not read |                                  |
| `src/app/panel/(app)/ayarlar/calisma-saatleri/page.tsx`                    |    18 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/ayarlar/clinic-profile-form.tsx`                      |    65 | not read |                                  |
| `src/app/panel/(app)/ayarlar/denetim/page.tsx`                             |   143 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/ayarlar/denetim/settings-card-static.tsx`             |    22 | not read |                                  |
| `src/app/panel/(app)/ayarlar/ekip/actions.ts`                              |   285 | read     |                                  |
| `src/app/panel/(app)/ayarlar/ekip/page.tsx`                                |    79 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/ayarlar/ekip/roles-manager.tsx`                       |   246 | not read |                                  |
| `src/app/panel/(app)/ayarlar/ekip/team-manager.tsx`                        |   389 | not read |                                  |
| `src/app/panel/(app)/ayarlar/hekimler/page.tsx`                            |    25 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/ayarlar/hekimler/practitioners-manager.tsx`           |   252 | not read |                                  |
| `src/app/panel/(app)/ayarlar/hizmetler/page.tsx`                           |    33 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/ayarlar/hizmetler/services-manager.tsx`               |   223 | not read |                                  |
| `src/app/panel/(app)/ayarlar/layout.tsx`                                   |    93 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/ayarlar/page.tsx`                                     |    27 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/ayarlar/panel-preferences-form.tsx`                   |    88 | not read |                                  |
| `src/app/panel/(app)/ayarlar/randevu-kurallari/booking-rules-form.tsx`     |   163 | not read |                                  |
| `src/app/panel/(app)/ayarlar/randevu-kurallari/page.tsx`                   |    18 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/ayarlar/settings-nav.tsx`                             |    36 | not read |                                  |
| `src/app/panel/(app)/ayarlar/sinirlar/page.tsx`                            |    89 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/ayarlar/takip/page.tsx`                               |    43 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/ayarlar/takip/rules-editor.tsx`                       |   544 | not read |                                  |
| `src/app/panel/(app)/ayarlar/tatiller/page.tsx`                            |    65 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/ayarlar/tatiller/time-off-manager.tsx`                |   236 | not read |                                  |
| `src/app/panel/(app)/ayarlar/yayina-hazirlik/page.tsx`                     |    68 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/geri-arama/actions.ts`                                |    34 | read     |                                  |
| `src/app/panel/(app)/geri-arama/callback-button.tsx`                       |    30 | not read |                                  |
| `src/app/panel/(app)/geri-arama/page.tsx`                                  |   114 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/hastalar/[id]/disa-aktar/route.ts`                    |    46 | read     |                                  |
| `src/app/panel/(app)/hastalar/[id]/page.tsx`                               |   201 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/hastalar/[id]/patient-actions.tsx`                    |   209 | not read |                                  |
| `src/app/panel/(app)/hastalar/actions.ts`                                  |   181 | read     |                                  |
| `src/app/panel/(app)/hastalar/page.tsx`                                    |   179 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/layout.tsx`                                           |    77 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/page.tsx`                                             |   226 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/randevular/[id]/appointment-actions.tsx`              |   132 | not read |                                  |
| `src/app/panel/(app)/randevular/[id]/page.tsx`                             |   168 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/randevular/actions.ts`                                |   176 | read     |                                  |
| `src/app/panel/(app)/randevular/booking-options.ts`                        |    24 | read     |                                  |
| `src/app/panel/(app)/randevular/new-appointment-dialog.tsx`                |   331 | not read |                                  |
| `src/app/panel/(app)/randevular/page.tsx`                                  |   319 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/takip/[id]/page.tsx`                                  |   202 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/takip/[id]/plan-controls.tsx`                         |   368 | not read |                                  |
| `src/app/panel/(app)/takip/actions.ts`                                     |   249 | skimmed  |                                  |
| `src/app/panel/(app)/takip/page.tsx`                                       |   193 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/takip/start-follow-up.tsx`                            |   138 | not read |                                  |
| `src/app/panel/(app)/takip/view-badge.tsx`                                 |    19 | not read |                                  |
| `src/app/panel/(app)/takvim/page.tsx`                                      |   249 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/takvim/practitioner-filter.tsx`                       |    47 | not read |                                  |
| `src/app/panel/(app)/tercihler/actions.ts`                                 |    30 | read     |                                  |
| `src/app/panel/(app)/tercihler/page.tsx`                                   |    33 | not read | auth guard present (grep)        |
| `src/app/panel/(app)/tercihler/preferences-form.tsx`                       |   121 | not read |                                  |
| `src/app/panel/actions.ts`                                                 |    18 | read     |                                  |
| `src/app/panel/baslangic/page.tsx`                                         |    18 | not read | auth guard present (grep)        |
| `src/app/panel/klinik-sec/page.tsx`                                        |    65 | not read | auth guard present (grep)        |
| `src/app/robots.ts`                                                        |    13 | not read |                                  |
| `src/app/server-actions.integration.test.ts`                               |   997 | not read |                                  |
| `src/app/sitemap.ts`                                                       |    15 | not read |                                  |
| `src/app/twitter-image.alt.txt`                                            |     1 | not read |                                  |
| `src/app/two-factor.integration.test.ts`                                   |   348 | not read |                                  |
| `src/components/design/action-button.tsx`                                  |    99 | not read |                                  |
| `src/components/design/glass-card.tsx`                                     |    23 | not read |                                  |
| `src/components/design/index.ts`                                           |     6 | not read |                                  |
| `src/components/design/logo.tsx`                                           |    15 | not read |                                  |
| `src/components/design/section-shell.tsx`                                  |    47 | not read |                                  |
| `src/components/design/status-tag.tsx`                                     |    19 | not read |                                  |
| `src/components/design/typography.tsx`                                     |    27 | not read |                                  |
| `src/components/panel/auto-refresh.tsx`                                    |    24 | not read |                                  |
| `src/components/panel/call-flag-badges.tsx`                                |    16 | not read |                                  |
| `src/components/panel/empty-state.tsx`                                     |    37 | not read |                                  |
| `src/components/panel/form-field.tsx`                                      |    59 | not read |                                  |
| `src/components/panel/index.ts`                                            |    13 | not read |                                  |
| `src/components/panel/outcome-badge.tsx`                                   |    16 | not read |                                  |
| `src/components/panel/page-header.tsx`                                     |    28 | not read |                                  |
| `src/components/panel/schedule/layout.test.ts`                             |    58 | not read |                                  |
| `src/components/panel/schedule/layout.ts`                                  |    92 | not read |                                  |
| `src/components/panel/schedule/schedule-grid.tsx`                          |   210 | not read |                                  |
| `src/components/panel/sortable-head.tsx`                                   |    49 | not read |                                  |
| `src/components/panel/status-badges.tsx`                                   |    52 | not read |                                  |
| `src/components/ui/avatar.tsx`                                             |    95 | not read |                                  |
| `src/components/ui/badge.tsx`                                              |    50 | not read |                                  |
| `src/components/ui/button.tsx`                                             |    66 | not read |                                  |
| `src/components/ui/calendar.tsx`                                           |   181 | not read |                                  |
| `src/components/ui/checkbox.tsx`                                           |    28 | not read |                                  |
| `src/components/ui/dialog.tsx`                                             |   145 | not read |                                  |
| `src/components/ui/dropdown-menu.tsx`                                      |   246 | not read |                                  |
| `src/components/ui/input.tsx`                                              |    24 | not read |                                  |
| `src/components/ui/label.tsx`                                              |    20 | not read |                                  |
| `src/components/ui/popover.tsx`                                            |    67 | not read |                                  |
| `src/components/ui/select.tsx`                                             |   184 | not read |                                  |
| `src/components/ui/separator.tsx`                                          |    27 | not read |                                  |
| `src/components/ui/sheet.tsx`                                              |   130 | not read |                                  |
| `src/components/ui/skeleton.tsx`                                           |    13 | not read |                                  |
| `src/components/ui/sonner.tsx`                                             |    46 | not read |                                  |
| `src/components/ui/switch.tsx`                                             |    32 | not read |                                  |
| `src/components/ui/table.tsx`                                              |    94 | not read |                                  |
| `src/components/ui/tabs.tsx`                                               |    79 | not read |                                  |
| `src/components/ui/textarea.tsx`                                           |    17 | not read |                                  |
| `src/components/ui/tooltip.tsx`                                            |    52 | not read |                                  |
| `src/instrumentation.ts`                                                   |    18 | read     |                                  |
| `src/lib/clinic-templates.ts`                                              |   193 | not read |                                  |
| `src/lib/cn.test.ts`                                                       |    23 | not read |                                  |
| `src/lib/cn.ts`                                                            |    57 | not read |                                  |
| `src/lib/contracts/appointment.ts`                                         |    68 | not read |                                  |
| `src/lib/contracts/auth.test.ts`                                           |    62 | not read |                                  |
| `src/lib/contracts/auth.ts`                                                |    58 | read     |                                  |
| `src/lib/contracts/call.ts`                                                |    75 | not read |                                  |
| `src/lib/contracts/demo-request.test.ts`                                   |    39 | not read |                                  |
| `src/lib/contracts/demo-request.ts`                                        |    42 | not read |                                  |
| `src/lib/contracts/follow-up.ts`                                           |   196 | not read |                                  |
| `src/lib/contracts/form-state.ts`                                          |    19 | not read |                                  |
| `src/lib/contracts/notification.ts`                                        |    56 | not read |                                  |
| `src/lib/contracts/panel-appointment.ts`                                   |    71 | not read |                                  |
| `src/lib/contracts/patient.ts`                                             |    15 | not read |                                  |
| `src/lib/contracts/platform.ts`                                            |    38 | not read |                                  |
| `src/lib/contracts/settings.ts`                                            |   186 | not read |                                  |
| `src/lib/contracts/sorting.ts`                                             |    30 | not read |                                  |
| `src/lib/contracts/team.test.ts`                                           |    49 | not read |                                  |
| `src/lib/contracts/team.ts`                                                |    42 | read     |                                  |
| `src/lib/env.ts`                                                           |   226 | read     |                                  |
| `src/lib/format.ts`                                                        |    46 | not read |                                  |
| `src/lib/holidays.ts`                                                      |    75 | skimmed  |                                  |
| `src/lib/names.test.ts`                                                    |    17 | not read |                                  |
| `src/lib/names.ts`                                                         |    15 | not read |                                  |
| `src/lib/permissions.test.ts`                                              |   112 | not read |                                  |
| `src/lib/permissions.ts`                                                   |   166 | read     |                                  |
| `src/lib/phone.test.ts`                                                    |    51 | not read |                                  |
| `src/lib/phone.ts`                                                         |    59 | read     |                                  |
| `src/lib/redact-log.test.ts`                                               |    37 | not read |                                  |
| `src/lib/redact.ts`                                                        |    23 | read     |                                  |
| `src/lib/safe-error.test.ts`                                               |    30 | not read |                                  |
| `src/lib/safe-error.ts`                                                    |    33 | read     |                                  |
| `src/lib/secret-scan.test.ts`                                              |    40 | not read |                                  |
| `src/lib/secret-scan.ts`                                                   |   106 | not read |                                  |
| `src/lib/security/csp.test.ts`                                             |    39 | not read |                                  |
| `src/lib/security/csp.ts`                                                  |    46 | read     |                                  |
| `src/lib/security/headers.test.ts`                                         |    21 | not read |                                  |
| `src/lib/voice-eval-budget.test.ts`                                        |    54 | not read |                                  |
| `src/proxy.ts`                                                             |    21 | read     |                                  |
| `src/server/auth/accounts.test.ts`                                         |   267 | not read |                                  |
| `src/server/auth/accounts.ts`                                              |   247 | read     |                                  |
| `src/server/auth/http-surface.test.ts`                                     |   156 | not read |                                  |
| `src/server/auth/http-surface.ts`                                          |    46 | read     |                                  |
| `src/server/auth/index.ts`                                                 |   237 | read     |                                  |
| `src/server/auth/platform.ts`                                              |    21 | read     |                                  |
| `src/server/auth/session-lifetime.test.ts`                                 |    17 | not read |                                  |
| `src/server/auth/session.ts`                                               |   124 | read     |                                  |
| `src/server/auth/team.ts`                                                  |   123 | read     |                                  |
| `src/server/auth/two-factor-policy.test.ts`                                |    45 | not read |                                  |
| `src/server/auth/two-factor.test.ts`                                       |   164 | not read |                                  |
| `src/server/auth/two-factor.ts`                                            |    92 | read     |                                  |
| `src/server/cron-auth.ts`                                                  |    30 | read     |                                  |
| `src/server/db/index.ts`                                                   |    32 | read     |                                  |
| `src/server/db/restore-verify.integration.test.ts`                         |    67 | not read |                                  |
| `src/server/db/schema.ts`                                                  |  1023 | skimmed  |                                  |
| `src/server/db/seed.ts`                                                    |   335 | not read |                                  |
| `src/server/db/tenant-constraints.test.ts`                                 |   193 | not read |                                  |
| `src/server/domain/appointments.integration.test.ts`                       |   460 | not read |                                  |
| `src/server/domain/appointments.ts`                                        |   706 | read     |                                  |
| `src/server/domain/audit.test.ts`                                          |   133 | not read |                                  |
| `src/server/domain/audit.ts`                                               |   212 | read     |                                  |
| `src/server/domain/availability.test.ts`                                   |   233 | not read |                                  |
| `src/server/domain/availability.ts`                                        |   186 | read     |                                  |
| `src/server/domain/booking-races.integration.test.ts`                      |   173 | not read |                                  |
| `src/server/domain/call-flag-records.test.ts`                              |    76 | not read |                                  |
| `src/server/domain/call-flag-records.ts`                                   |    95 | read     |                                  |
| `src/server/domain/call-flags-fixtures.test.ts`                            |    92 | not read |                                  |
| `src/server/domain/call-flags.test.ts`                                     |   106 | not read |                                  |
| `src/server/domain/call-flags.ts`                                          |   167 | read     |                                  |
| `src/server/domain/call-patient.integration.test.ts`                       |   126 | not read |                                  |
| `src/server/domain/call-patients.ts`                                       |    21 | read     |                                  |
| `src/server/domain/callback-family.integration.test.ts`                    |   116 | not read |                                  |
| `src/server/domain/calls.ts`                                               |   216 | read     |                                  |
| `src/server/domain/clinic-settings.ts`                                     |    92 | read     |                                  |
| `src/server/domain/clinics.ts`                                             |   100 | read     |                                  |
| `src/server/domain/data-integrity.integration.test.ts`                     |   136 | not read |                                  |
| `src/server/domain/demo-requests.ts`                                       |    23 | not read |                                  |
| `src/server/domain/erasure-family.integration.test.ts`                     |   256 | not read |                                  |
| `src/server/domain/erasure.test.ts`                                        |   179 | not read |                                  |
| `src/server/domain/errors.ts`                                              |    61 | not read |                                  |
| `src/server/domain/export-family.integration.test.ts`                      |   185 | not read |                                  |
| `src/server/domain/follow-up-logic.test.ts`                                |   130 | not read |                                  |
| `src/server/domain/follow-up-logic.ts`                                     |   111 | not read |                                  |
| `src/server/domain/follow-ups.test.ts`                                     |   756 | not read |                                  |
| `src/server/domain/follow-ups.ts`                                          |   947 | skimmed  |                                  |
| `src/server/domain/go-live.integration.test.ts`                            |    92 | not read |                                  |
| `src/server/domain/go-live.ts`                                             |   125 | skimmed  |                                  |
| `src/server/domain/hourly-reminders.integration.test.ts`                   |   145 | not read |                                  |
| `src/server/domain/job-runs.test.ts`                                       |   125 | not read |                                  |
| `src/server/domain/job-runs.ts`                                            |   153 | read     |                                  |
| `src/server/domain/kvkk-end-to-end.integration.test.ts`                    |   132 | skimmed  |                                  |
| `src/server/domain/notifications.test.ts`                                  |   454 | not read |                                  |
| `src/server/domain/notifications.ts`                                       |   876 | read     |                                  |
| `src/server/domain/panel.test.ts`                                          |   374 | not read |                                  |
| `src/server/domain/panel.ts`                                               |  1351 | read     |                                  |
| `src/server/domain/patient-correction.integration.test.ts`                 |    50 | not read |                                  |
| `src/server/domain/patients-per-name.integration.test.ts`                  |   290 | not read |                                  |
| `src/server/domain/patients-per-name.ts`                                   |    18 | read     |                                  |
| `src/server/domain/preferences.ts`                                         |    56 | not read |                                  |
| `src/server/domain/provider-deletions.ts`                                  |   148 | read     |                                  |
| `src/server/domain/rate-limit.test.ts`                                     |    53 | not read |                                  |
| `src/server/domain/rate-limit.ts`                                          |    75 | read     |                                  |
| `src/server/domain/recording-access.test.ts`                               |    27 | not read |                                  |
| `src/server/domain/recording-access.ts`                                    |    23 | read     |                                  |
| `src/server/domain/retention.test.ts`                                      |   113 | not read |                                  |
| `src/server/domain/retention.ts`                                           |   131 | read     |                                  |
| `src/server/domain/scheduling.ts`                                          |   243 | read     |                                  |
| `src/server/domain/search-wildcards.integration.test.ts`                   |    47 | not read |                                  |
| `src/server/domain/settings.test.ts`                                       |   195 | not read |                                  |
| `src/server/domain/settings.ts`                                            |   495 | read     |                                  |
| `src/server/domain/speech.test.ts`                                         |    76 | not read |                                  |
| `src/server/domain/speech.ts`                                              |   111 | not read |                                  |
| `src/server/domain/tenant-isolation.test.ts`                               |   134 | not read |                                  |
| `src/server/domain/test-calls.integration.test.ts`                         |    81 | not read |                                  |
| `src/server/domain/test-calls.ts`                                          |    16 | read     |                                  |
| `src/server/domain/time-edges.test.ts`                                     |    60 | not read |                                  |
| `src/server/domain/time.ts`                                                |   107 | read     |                                  |
| `src/server/domain/tool-requests.test.ts`                                  |    83 | not read |                                  |
| `src/server/domain/tool-requests.ts`                                       |   133 | read     |                                  |
| `src/server/domain/voice-limits.test.ts`                                   |   170 | not read |                                  |
| `src/server/domain/voice-limits.ts`                                        |   134 | read     |                                  |
| `src/server/notifications/email-templates.ts`                              |   130 | not read |                                  |
| `src/server/notifications/email.ts`                                        |    83 | read     |                                  |
| `src/server/notifications/sms.ts`                                          |   125 | read     |                                  |
| `src/server/observability/alarm.ts`                                        |    23 | read     |                                  |
| `src/server/observability/sentry.test.ts`                                  |    46 | not read |                                  |
| `src/server/observability/sentry.ts`                                       |    61 | read     |                                  |
| `src/server/patient-number-guard.ts`                                       |    31 | not read |                                  |
| `src/server/platform/admins.ts`                                            |    42 | not read |                                  |
| `src/server/platform/clinics.test.ts`                                      |    97 | not read |                                  |
| `src/server/platform/clinics.ts`                                           |   294 | skimmed  |                                  |
| `src/server/platform/demo-requests.ts`                                     |    25 | not read |                                  |
| `src/server/production-safety.test.ts`                                     |   422 | not read |                                  |
| `src/server/security/rate-limits.ts`                                       |    94 | read     |                                  |
| `src/server/voice/prompt.test.ts`                                          |   347 | not read |                                  |
| `src/server/voice/prompt.ts`                                               |   425 | read     |                                  |
| `src/server/voice/providers/retell/agent-spec.test.ts`                     |   206 | not read |                                  |
| `src/server/voice/providers/retell/agent-spec.ts`                          |   228 | read     |                                  |
| `src/server/voice/providers/retell/config.ts`                              |    51 | read     |                                  |
| `src/server/voice/providers/retell/deps.ts`                                |    64 | read     |                                  |
| `src/server/voice/providers/retell/erased-late-events.integration.test.ts` |   152 | not read |                                  |
| `src/server/voice/providers/retell/event-order.integration.test.ts`        |   148 | not read |                                  |
| `src/server/voice/providers/retell/handlers.integration.test.ts`           |  1216 | not read |                                  |
| `src/server/voice/providers/retell/handlers.ts`                            |   395 | read     |                                  |
| `src/server/voice/providers/retell/load.integration.test.ts`               |   122 | not read |                                  |
| `src/server/voice/providers/retell/recordings.ts`                          |    48 | read     |                                  |
| `src/server/voice/providers/retell/schedule-sync.ts`                       |    92 | read     |                                  |
| `src/server/voice/providers/retell/schemas.ts`                             |    55 | read     |                                  |
| `src/server/voice/providers/retell/sync.integration.test.ts`               |   151 | not read |                                  |
| `src/server/voice/providers/retell/sync.ts`                                |   130 | read     |                                  |
| `src/server/voice/providers/retell/test-call.test.ts`                      |    27 | not read |                                  |
| `src/server/voice/providers/retell/test-call.ts`                           |    90 | read     |                                  |
| `src/server/voice/providers/retell/tool-failsafe.test.ts`                  |    89 | not read |                                  |
| `src/server/voice/providers/retell/voices.test.ts`                         |    47 | not read |                                  |
| `src/server/voice/providers/retell/voices.ts`                              |    63 | not read |                                  |
| `src/server/voice/sync.ts`                                                 |    29 | read     |                                  |
| `src/server/voice/tools/book-appointment.ts`                               |    78 | read     |                                  |
| `src/server/voice/tools/caller.ts`                                         |   129 | read     |                                  |
| `src/server/voice/tools/cancel-appointment.ts`                             |    65 | read     |                                  |
| `src/server/voice/tools/check-availability.ts`                             |    84 | read     |                                  |
| `src/server/voice/tools/create-callback-request.ts`                        |    58 | read     |                                  |
| `src/server/voice/tools/define.ts`                                         |    56 | read     |                                  |
| `src/server/voice/tools/fallbacks.test.ts`                                 |   129 | read     |                                  |
| `src/server/voice/tools/find-appointments.ts`                              |   118 | read     |                                  |
| `src/server/voice/tools/index.ts`                                          |   103 | read     |                                  |
| `src/server/voice/tools/reschedule-appointment.ts`                         |    77 | read     |                                  |
| `src/server/voice/tools/schemas.ts`                                        |    26 | read     |                                  |
| `src/test/actions.ts`                                                      |   111 | not read |                                  |
| `src/test/db.ts`                                                           |   104 | read     |                                  |
| `src/test/global-setup.ts`                                                 |    41 | not read |                                  |
| `src/test/server-only-stub.ts`                                             |     1 | not read |                                  |
| `tsconfig.json`                                                            |    34 | not read |                                  |
| `vercel.json`                                                              |     9 | read     |                                  |
| `vitest.config.mts`                                                        |    19 | read     |                                  |
