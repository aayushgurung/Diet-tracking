# Testing

## Automated checks

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Vitest covers name normalization, case/whitespace/punctuation, exact aliases, no substring assumptions, archived warnings, scoped watchlists, DST conversion, local calendar grouping independent of record creation, image type/size/signatures, Zod validation and server trust boundaries. React Testing Library exercises warning-before-submit, nonblocking continuation, dismiss/reset behavior, ingredient matching, failed saves/retry, timezone history filters, settings validation and destructive account confirmation.

Playwright starts or reuses the production server on port 3000 and runs desktop/mobile smoke checks. Always rebuild after source changes before running it. The unauthenticated suite checks guards, auth navigation, page overflow, private API rejection and callback origin isolation.

For the full real-account loop:

1. Apply the migration to a disposable Supabase project.
2. Create and confirm a dedicated test account. Keep warning display enabled in its settings.
3. Set `E2E_EMAIL` and `E2E_PASSWORD` in `.env.local`. Optionally supply `E2E_OTHER_EMAIL`/`E2E_OTHER_PASSWORD` for browser-level isolation.
4. Rebuild using the same Supabase project URL/key, then run `npm run test:e2e`.

The test logs in, saves a uniquely named food, flags it, adds symptoms, finds its warning before saving a second entry, opens historical reactions, continues logging, then archives the warning. It removes its exact generated entries/watchlist item using the same user's RLS-scoped session. Never point it at an account with valuable data. If test credentials are missing the real loop is visibly **skipped**, not reported as a passing persistence test.

## Database/RLS integration

After applying the migration, use a disposable local Supabase database:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

The script runs in a rollback transaction and creates two temporary users. It checks owner SELECT/INSERT/UPDATE/DELETE behavior, anonymous denial, relationship ownership, private Storage path policies, transactional flag/report/watchlist updates, report editing, archive preservation, immutable creation timestamps, profile timezone and staged-photo adoption. Run as the postgres role; a publishable key cannot run this SQL administration script.

During implementation the full migration and test script were also executed against an isolated PostgreSQL 15 cluster with minimal Supabase auth/storage schema stubs. That proves SQL syntax, transaction behavior and PostgreSQL RLS assertions, but does not prove real Supabase email delivery or the hosted Storage API is configured.

## Manual acceptance checks

- On a 360px phone, save a name/time with no optional fields; check keyboard navigation and focus, camera/file picker, loading and failure feedback.
- Save food eaten earlier in the day; confirm detail shows distinct eaten/recorded timestamps. Change timezone and check midnight history grouping. Check a spring DST gap is rejected.
- Flag without symptoms, then edit to several symptoms and a self-reported severity. Confirm warnings cite actual notes and still allow logging.
- Confirm an archived warning disappears while the historical red flag/report remain. Undo a flag and remove reaction details independently.
- Upload/replace/remove/delete a photo and verify signed access, different-user access denial and eventual media cleanup.
- Sign out and return; try another device. Confirm private entries/warnings appear only for the correct user.
- Export data, then test password-confirmed deletion with a disposable account and verify records and Storage objects are gone.

Hosted persistence, production Auth/Storage and cross-device testing require your project credentials. Reduced-motion styling, SVG states and mobile overflow can be verified without those credentials; a setup screen is deliberately shown when the backend is absent.
