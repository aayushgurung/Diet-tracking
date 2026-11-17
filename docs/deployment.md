# Deploying Food Journal

## Vercel

1. Push the `food-journal` project to your Git repository. If this folder is inside a larger repository, select `food-journal` as Vercel's Root Directory.
2. Import it into Vercel and keep the detected **Next.js** framework preset. Use Node.js 24, install `npm ci`, build `npm run build`. Do not use a static export: authentication, server actions, signed photos and account management need the server.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) to the appropriate deployment environments. These public variables are embedded during the build; changing them requires a rebuild.
4. Add `SUPABASE_SERVICE_ROLE_KEY` as a **server-only** environment variable to enable account deletion. Add a random `CRON_SECRET` for automated cleanup. Use separate Supabase projects for preview/testing and production.
5. Apply the migration to the selected Supabase project. Configure the Auth Site URL, allowed callback origin, confirmation/recovery templates and production SMTP as described in the README. Restrict production redirect URLs to actual trusted origins.
6. Deploy and verify signup/email confirmation, logout/login, photo upload, flagging, repeated-food warnings, archiving, export and persistence in a second browser. Use dedicated disposable accounts to verify isolation. Perform account-deletion checks only with an account you intend to delete.

For scheduled cleanup, optionally add this `vercel.json` at the project root **after** setting `CRON_SECRET` and the service key:

```json
{
  "crons": [{ "path": "/api/cleanup", "schedule": "0 3 * * *" }]
}
```

Vercel sends `Authorization: Bearer <CRON_SECRET>` to the cleanup route. The route processes up to 500 due jobs each run; schedule more often if needed. Without a scheduler, due jobs retry on later food mutations. Other schedulers can call the same endpoint with that bearer header. Do not put the secret in URLs or source control.

## Other hosts

Use a Node-compatible Next.js host with HTTPS and persistent environment variables:

```sh
npm ci
npm run build
npm start
```

The app stores durable data in Supabase, so it does not require a writable server filesystem. Its native Next.js server output cannot be deployed as a static Sites archive or directly as a Cloudflare Worker. This repository retains the requested Next.js architecture and Vercel compatibility; no live deployment or hosting account is provisioned by the local build.

Supabase's private bucket and RLS policies are required even if the hosting URL itself has an access gate. Avoid sharing cached private responses or photo signed URLs; responses are marked private/no-store and authentication is checked on trusted boundaries. Configure database backups and platform monitoring for production without logging food notes or reaction content.
