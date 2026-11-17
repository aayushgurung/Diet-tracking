# Supabase setup and security

1. Create a Supabase project. In **Authentication → Providers**, enable email/password. Keep email confirmation enabled for production.
2. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the legacy anon key is supported through `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Never put the service-role key in a `NEXT_PUBLIC_` variable.
3. Apply `supabase/migrations/202611170001_food_journal.sql` in the SQL editor, or link the project with the Supabase CLI and run `supabase db push`. The migration creates tables, indexes, owner RLS policies, transactional RPCs, profile creation, and the **private** `food-photos` bucket. Do not change this bucket to public.
4. In **Authentication → URL Configuration**, set Site URL to the application origin and allow `http://localhost:3000/auth/callback` plus the production callback URL. For reliable confirmation links on another device, edit the **Confirm signup** email template to use `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`. PKCE `code` callbacks are also supported.
5. Set `SUPABASE_SERVICE_ROLE_KEY` only in the server deployment environment to enable account deletion. The application verifies the signed-in user's current password, removes their storage objects, then deletes their auth user; database cascades delete their journal data. Without this key the delete endpoint returns an explicit configuration error and does not pretend to delete anything.
6. Restart the dev server after changing environment variables. Sign up, confirm the email, and sign in. A missing connection displays the setup screen rather than an imitation authenticated journal.

For optional fictional development records, create a dedicated test account, run `select set_config('app.seed_user_id', 'YOUR_TEST_USER_UUID', false);` in a database session, then execute `supabase/seed.sql` in that same session. Without the explicit user setting the seed is a no-op. It adds two clearly marked sample foods, including a suspected observation; it never creates or impersonates an authenticated account.

## Data model

`profiles` stores display preferences and an IANA timezone. `food_entries` stores user-chosen `eaten_at` independently of immutable database-generated `created_at`. `food_components` stores individually entered food items and ingredients. `reaction_reports` has one editable multi-symptom report per entry. `trigger_foods` stores the active or archived watchlist; aliases are separate rows in `trigger_food_aliases`. An entry's optional `trigger_food_id` preserves the association if its watchlist display name changes.

Flagging is transactional: save the reaction, flag the entry, and create/reactivate the watchlist item together. Editing a report does not generate duplicate reports. Undoing a flag leaves both the report and the watchlist item intact; watchlist archiving is explicit. Deleting an entry removes its report/components and retains the watchlist.

## Privacy and photo lifecycle

All seven user-owned tables use RLS for SELECT/INSERT/UPDATE/DELETE. Related rows use owner-composite foreign keys to block cross-user relationship injection. Server actions verify the current auth user again; they do not trust a user ID from the browser. All database functions that write journal data are security invokers, use the caller's RLS, and are not executable anonymously.

Storage policies restrict access to `food-photos/<user-id>/<uuid>.jpg|jpeg|png|webp`. The private bucket limits uploads to 10 MB JPEG/PNG/WebP. The UI compresses supported images before upload. Saved photos use signed URLs that expire after one hour. Exports contain photo paths, not image binaries or signed access URLs.

Uploads go through `/api/photos`, which verifies the authenticated user, file size, MIME type and image magic bytes. It registers a staged cleanup job before uploading; saving the food atomically adopts the upload and removes that job. Unadopted uploads expire after one hour. A database lease prevents an expired upload from being adopted once cleanup starts.

Replacing/removing/deleting a photo writes a durable `media_cleanup_jobs` record in the same database transaction. The server attempts deletion after the mutation and retries due jobs on later food mutations. A storage outage therefore does not silently discard cleanup intent. Never delete storage metadata directly with SQL: use the Storage API.

For cleanup even when nobody uses the app, set a random server-only `CRON_SECRET` and invoke `GET /api/cleanup` daily with `Authorization: Bearer <CRON_SECRET>`. The endpoint also needs `SUPABASE_SERVICE_ROLE_KEY`, processes up to 500 jobs per request, and checks live entry references before deletion. Vercel Cron sends this bearer value automatically when the project uses `CRON_SECRET`; a daily cron route may be configured for `/api/cleanup`. Account deletion removes every object under the user's prefix, including abandoned uploads.

## Verification

Run `supabase/tests/rls.sql` through `psql` against a disposable local Supabase database as the postgres role:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

The script creates two temporary auth users, switches into authenticated and anonymous roles, checks owner isolation and relationship injection, and rolls everything back. It must run after the migration. It intentionally does not use real journal data. Run end-to-end tests using dedicated disposable user credentials, never production accounts.

The application uses no diagnostic model, ingredient inference, or medically established risk scoring. Exact normalized names and explicit aliases are the only warning matches. PostgreSQL normalizes names using NFKC/lowercase/alphanumeric token separation; JavaScript does the corresponding Unicode letter/number separation. PostgreSQL collation can differ for uncommon scripts; display names are normalized again in JavaScript for warning comparisons.
