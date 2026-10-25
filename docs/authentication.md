# Private accounts and wardrobe storage

The landing page is `/`; `/app` requires a Supabase session. Guests are redirected to the sign-in form. Missing configuration fails closed. The wardrobe never mounts until the server has verified the session and established its HttpOnly, SameSite=Strict cookie. API routes independently verify Supabase JWT claims; hiding the page is not the authorization boundary. Deploy behind HTTPS and set `APP_HTTPS=true` when TLS terminates at a proxy.

## Project setup

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the ignored env file. Run [the migration](../supabase/migrations/202610250001_private_wardrobe.sql) in the same project's Supabase SQL Editor. Alternatively add the server-only `SUPABASE_DB_URL` and run `npm run db:setup`. The command verifies TLS; `SUPABASE_DB_SSL_CA` can point to your project's CA certificate. No service-role key is needed by the application.

The migration creates:

- `wardrobe_garments`: garment metadata, scoped by `user_id`.
- `wardrobe_fits`: dated garment snapshots and optional existing previews.
- `wardrobe_settings`: the account's reference-photo path.
- `wardrobe-private`: a private PNG bucket; objects are under `<user-id>/items/`, `<user-id>/fits/`, `<user-id>/reference/` and `<user-id>/previews/`.

All three tables have Row Level Security policies requiring `auth.uid() = user_id`. Storage policies require the same user ID in the first folder. The server uses the public project key plus the authenticated user's token, so database and bucket ownership policies remain enforced. Existing `profiles` and `wardrobe_items` tables are preserved.

The project should allow the app origin and `/app` confirmation redirect in Auth URL settings. Signup carries the username as auth metadata; profile lookup/creation waits for an authenticated session. Confirmation-required signup never attempts an anonymous profile insert.

## Data and privacy

Uploads, metadata changes, saved-fit snapshots, existing preview images and reference photos use Supabase. Browser uploads go directly to the private bucket and are validated by the server before their metadata is saved. Private image endpoints use the account session and return uncached redirects to 60-second signed download URLs. Service workers never cache account APIs or private images and remove older shared wardrobe caches on activation. Builder drafts contain only garment IDs in browser storage, keyed by account. In-memory preview caches are cleared on account changes.

“Your reference photo” below the photo try-on button uploads the signed-in user's own identity reference. Photo try-on never falls back to the shared local reference. Uploading or saving does not call a paid AI provider. OpenAI, Decart and Photoroom requests still require explicit user actions and are protected by the server session check.

New accounts start empty. The previous ignored `data/` wardrobe is retained as a local backup, is blocked from Vite file serving, and is not automatically assigned to the first person who signs up. The seed command is a legacy local-data utility, not an automatic cloud import.

### One-time local migration

The maintenance helper in `scripts/migrate-local-data.mjs` copies the local library, saved-fit snapshots, existing previews and source attributions into an explicitly selected signed-in account. It preserves IDs, metadata and saved dates. It preflights every referenced file, verifies uploaded image bytes, skips existing account records to preserve newer edits, and resumes interrupted copies without duplicating photos. It never deletes local files or invokes an AI provider.

The completed one-time migration used an authenticated endpoint pinned to the destination user ID and a local random capability. Its receipt and source backup remain ignored. The capability was archived, and the endpoint has been removed from the running application. The migration helper and its tests remain available for operator-led migrations; no account can claim local files through the deployed app. The migration also retained a valid legacy browser draft when the destination had no draft.

Run Vite dev/preview locally or deploy the included Node function to Vercel; a static-only host does not implement the protected server endpoints. Signing out unmounts the wardrobe and clears the server cookie. Authentication credentials are never stored in source control.

## Verification

`npm test` includes guest/expired/invalid token rejection, cross-site mutation rejection, cookie setup/logout, two-account garment/photo/fit/reference isolation, snapshot retention and preview-cache clearing. These injected tests do not create accounts or call paid AI providers.

References: [Supabase claims verification](https://supabase.com/docs/reference/javascript/auth-getclaims), [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Storage RLS](https://supabase.com/docs/guides/storage/security/access-control).
