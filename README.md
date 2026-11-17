# Food Journal

A private food memory journal with a friendly SVG companion. Record what you ate, keep personal reaction notes, and see a reminder **before saving** a food you previously flagged. No calories, nutrition scores, weight tracking, diagnoses, ingredient guessing, or external AI services.

## Understand and debug the application

Read [the detailed system workflows](docs/system-workflows.md) for architecture, signup/email verification, food/reaction mutations, warning matching, database relationships, private photo cleanup and account deletion diagrams. Use [the debugging field guide](docs/debugging.md) to map a symptom to files, requests, database checks and focused tests.

**Configuration note:** the current runtime reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON`, while the original setup/example below uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`. See [the environment boundary explanation](docs/system-workflows.md#15-deployment-and-environment-boundaries) before configuring or debugging a deployment.

## Run locally

Requires Node.js 22.16+ (Node 24 recommended) and npm. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

```sh
npm ci
cp .env.example .env.local
# Fill in the Supabase variables described below.
npm run dev
```

Open [localhost:3000](http://localhost:3000). Without Supabase configuration the app shows an explicit setup screen; it does not simulate sign-in or claim to save data. Windows file copy: `Copy-Item .env.example .env.local`.

## Supabase setup

1. Create a Supabase project. Enable email/password authentication. Keep email confirmation enabled in production.
2. Set the public project URL and publishable/anon key in `.env.local`.
3. Apply [the migration](supabase/migrations/202611170001_food_journal.sql) in the Supabase SQL Editor, **once**. Alternatively, install the Supabase CLI, run `supabase init` to generate its local configuration, then `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, and `supabase db push` from this folder. Keep the existing migration and seed files when initializing. The migration creates all tables, indexes, transactional functions, RLS policies, profile creation and the private `food-photos` Storage bucket. Do not make the bucket public.
4. In Authentication → URL Configuration, set your application origin as Site URL and allow `http://localhost:3000/auth/callback` and your production `/auth/callback` URL. Allow a query string if your redirect configuration requires it for password recovery.
5. For email confirmation across devices, set the **Confirm signup** email link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`. For password recovery, set the **Reset password** email link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`. PKCE code callbacks also work; their originating browser must retain the verifier cookie. Configure a production SMTP provider in Supabase.
6. Restart the dev server. Create an account, confirm the email, then sign in. The signup timezone comes from the browser and can be changed in Settings.

See [the detailed database, security and photo lifecycle guide](docs/supabase.md).

| Environment variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Required project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required publishable or legacy anon key; browser-safe because RLS enforces ownership |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Alternative to the anon-key variable; takes precedence when set |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only; enables password-confirmed account deletion and scheduled cleanup |
| `CRON_SECRET` | Optional server-only random bearer secret for `/api/cleanup` |
| `E2E_EMAIL`, `E2E_PASSWORD` | Optional dedicated, confirmed test account for full browser tests |
| `E2E_OTHER_EMAIL`, `E2E_OTHER_PASSWORD` | Optional second dedicated account for the browser isolation check |
| `E2E_BASE_URL` | Optional running application origin for Playwright |

Never prefix the service-role key or cron secret with `NEXT_PUBLIC_`. Never commit `.env.local`.

## What is implemented

- Supabase signup, login, email confirmation, password recovery, persistent cookie sessions, server guards and sign out.
- Today timeline, food creation/editing/deletion, explicitly assigned meal categories, separate foods/ingredients, notes and private photos.
- Client photo preview, camera input, byte/type/size validation, metadata-stripping compression, replacement/removal and durable abandoned/replaced-media cleanup.
- One editable multi-symptom reaction report per entry, optional reported severity, onset, reaction time and notes. Details are optional when flagging.
- Active/archived trigger watchlist, explicit aliases, search/sorting, first/last flag dates, counts and linked reaction history.
- Immediate exact-name/alias warnings while typing, latest recorded symptom summary, historical links, dismissal and an unrestricted choice to continue saving.
- Five data-driven companion expressions, warning text that remains available without the illustration, reduced-motion support, desktop sidebar and safe-area mobile navigation.
- Timezone-based Today/History grouping, date navigation, search and flag filters; eaten time and immutable database creation time displayed separately.
- Profile/timezone/warning preferences, JSON export, and password-confirmed account/data deletion.

## Project structure

```text
src/app/(journal)/       Protected Today, Add Food, entry, triggers, history, settings
src/app/login/          Authentication UI
src/app/auth/callback/  Verified email/recovery callbacks
src/app/api/            Photo upload, export, account deletion, scheduled cleanup
src/components/         Forms, journal cards, warnings, SVG avatar, app shell
src/components/ui/      Local shadcn-style Button and Radix dialog primitives
src/lib/server/         Authenticated queries, validated actions, media lifecycle
src/lib/supabase/       Browser, cookie-based server and server-only admin clients
src/lib/                Types, Zod schemas, exact matching, timezone/image utilities
supabase/migrations/    PostgreSQL schema, RLS, private Storage policies, RPCs
supabase/tests/         Transactional database behavior and two-user isolation checks
tests/e2e/              Playwright desktop/mobile smoke and real-account loop
scripts/seed.mjs        Opt-in samples for a disposable development account
docs/                   Setup, testing and deployment detail
```

Change the name in [`src/lib/config.ts`](src/lib/config.ts); theme tokens live in `src/app/globals.css`, and journal layouts in `src/app/journal.css`.

## Development data

No sample records are inserted into real accounts automatically. To seed a **disposable development account**, confirm its email, then set `SEED_EMAIL`, `SEED_PASSWORD` and `SEED_CONFIRM=DEVELOPMENT` in your shell and run:

```sh
node scripts/seed.mjs
```

The script signs in using that user's own RLS-scoped session and inserts three clearly labelled samples. It does not use a service key. Repeat runs skip existing samples. Clear these variables afterward. Do not use production accounts.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright uses a production build. If no local browser is installed, run `npx playwright install chromium`. It checks both desktop and a 390px mobile viewport. Real sign-in/persistence tests are explicitly skipped unless a migrated project and dedicated test credentials are supplied. [.env.local is loaded by the Playwright configuration](playwright.config.ts).

See [testing instructions and verification limits](docs/testing.md). Database isolation is tested separately from browser UI tests; passing mocked component tests does not establish that a hosted Supabase installation is configured correctly.

## Deployment and practical limits

Deploy this standard Next.js App Router application to Vercel or another Node-compatible Next.js host. See [deployment instructions](docs/deployment.md).

Supabase credentials are intentionally not bundled. Hosted Auth, private Storage, device-to-device persistence, production SMTP and real-account E2E checks must be verified after you configure your project. Account deletion is visibly unavailable until the server-only service key is supplied. A daily cleanup scheduler is recommended for abandoned uploads when nobody returns to the app.

Photos use one-hour signed URLs; refresh the page to renew access after a tab has been idle longer than that. JSON exports contain photo paths and journal data, not image binaries. The app fetches paged database results into one personal-journal view; very large journals would benefit from date-range server queries before broader use. Daylight-saving gaps are rejected; repeated wall times select the earlier occurrence. The form protects against reload and ordinary link navigation with unsaved edits; browser history navigation remains browser-controlled.

Flagged entries, reaction reports and watchlist activity are separate records. Undoing a flag preserves the report and watchlist; deleting reaction details preserves the flag; archiving a warning preserves all historical entries. Nothing in this app confirms a food caused a symptom or establishes that a food is safe.
