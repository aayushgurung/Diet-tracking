# Verification — 17 November 2026

Environment: Windows, Node.js 24.18.0, npm 10.2.4, Next.js 16.4.6, React 19.3.1.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, no warnings/errors |
| `npm run typecheck` | Passed, strict TypeScript |
| `npm test` | 108 tests passed in 14 suites |
| `npm run build` | Passed, native Next.js production build |
| `npm run test:e2e` | 8 desktop/mobile smoke tests passed; 2 real-account flows explicitly skipped |
| Full SQL migration | Executed successfully on isolated PostgreSQL 15 with minimal Supabase auth/storage schema test doubles |
| `supabase/tests/rls.sql` | Passed owner isolation, anonymous denial, cross-owner relationship injection, private storage path policies, flag/report/watchlist transactions, timestamp preservation and staged-media leasing assertions |
| Development SQL seed | No-op without explicit test user; explicit seeding and repeated-run idempotency passed |
| Browser visual checks | Login/setup at 390px/1440px; protected layouts with synthetic test-only fixtures at 360px/390px/1440px; no horizontal overflow observed |
| Mobile primary save | Visible before scrolling, clears bottom navigation |

The two live-account browser flows were skipped because no Supabase project or dedicated user credentials were supplied. No fake authentication or database service was substituted to claim a successful live persistence test. Component tests mock server calls; PostgreSQL tests validate SQL and RLS semantics. Actual hosted Supabase Auth, email delivery, Storage API, account deletion and cross-device persistence still need verification with the configured service.

Visual fixtures were rendered only into temporary local QA HTML; there are no production demo endpoints or seeded real accounts. Screenshots in this folder's `screenshots/` directory show synthetic entries. All temporary PostgreSQL clusters, fixture-render helpers and preview servers were stopped/removed after verification.

See `docs/testing.md` for reproducible commands and real-service prerequisites.
