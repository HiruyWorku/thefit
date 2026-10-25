# Account and route integration

The landing page is `/`; the wardrobe, builder and outfit calendar are at `/app`. Account sign-in uses the existing Supabase project and `profiles` table. Wardrobe items and saved-fit snapshots continue using the local server data directory; adding account authentication does not migrate or partition that storage by user.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the ignored environment file and restart Vite. These are the project URL and public browser key. OpenAI, Decart and Photoroom keys remain server-only. Missing Supabase settings show a local-mode message instead of crashing the application.

Signup sends the normalized username as auth metadata. When email confirmation is required, the form asks the user to check their inbox. Profile lookup/creation runs only after an authenticated session exists, outside the auth-state callback. Existing profiles are preserved; new profiles default to private. Profile failures are reported separately and do not erase a successful account session. Login navigates to `/app`, session changes are shared between routes, and sign-out is available in the wardrobe header.

The Supabase project should allow the app's origin and `/app` confirmation redirect in its Auth URL settings. Its `profiles` table uses `id`, `username` and `is_public`, with authenticated users permitted to select and create their own row under Row Level Security. No service-role key is required in the browser.

References: [Supabase signup](https://supabase.com/docs/reference/javascript/auth-signup), [auth-state events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [user profiles and RLS](https://supabase.com/docs/guides/auth/managing-user-data).

Auth and profile behavior are covered with injected test clients. The configured project was checked through read-only auth-settings and zero-row profile-schema requests; account creation and verification emails are not part of automated checks.
