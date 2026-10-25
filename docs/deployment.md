# Deployment and verification

Production: [thefit-alpha.vercel.app](https://thefit-alpha.vercel.app). The shared API health check is `/api/health`.

## Runtime

Use Node.js 24. Vite builds the frontend; `api/index.mjs` runs the shared `scripts/api-handler.mjs` middleware on Vercel. `vercel.json` routes `/api/*` to that function and `/app` to the SPA. Local dev and preview use the same authentication, wardrobe, upload-processing and try-on handlers.

The migration endpoint is no longer mounted. The local source wardrobe, migration receipt and backup remain outside deployment and version control. Existing cloud data needs no reimport when deploying a new frontend.

## Environment and authentication

Set the variables listed in the README in the Vercel Production environment. Only the two public Supabase variables have a `VITE_` prefix. Permanent provider keys remain server-side. Do not upload `.env` files or configure database passwords/service-role keys in the app.

Set `APP_HTTPS=true`. In Supabase Authentication → URL Configuration, set the production Site URL and add the exact production `/app` redirect. Retain explicit local redirect URLs for development. Signing in on a production origin creates a separate browser session from localhost; the same Supabase account still owns the same cloud wardrobe.

## Large images and timeouts

Vercel functions have a [4.5 MB request/response limit](https://vercel.com/docs/functions/limitations). The browser converts uploads to PNG, preserves transparency, limits the longest edge to 2,400 pixels, and uploads directly to the account's private Supabase folder. Finalization requests contain metadata and an object path; the server validates the owned PNG before saving its record.

Private image endpoints issue 60-second signed redirects instead of proxying large image bodies. Canvas images use anonymous CORS so the wardrobe color sampler still works. Generated previews stay in private storage, and saving a preview copies it inside the account without a base64 round trip through the browser.

The API function permits 300 seconds. OpenAI requests time out after 240 seconds, leaving time to return a useful error. Completed photo previews are keyed by account, reference bytes, garment bytes/metadata, model and quality; they are reused across server restarts. Concurrent identical requests within one instance share work. This is not a global paid-usage quota across accounts or instances; configure provider-side spending limits for a public deployment.

## Release process

1. Run `npm ci` and `npm run check`.
2. Run `npm audit --omit=dev --audit-level=high` and inspect any remaining findings.
3. Confirm `.env`, `data/`, `.vercel/` and local account photos are ignored. Check staged files and built browser assets for private credentials.
4. Commit and push the exact code intended for deployment.
5. Run `vercel --prod`, then verify the deployed commit and URL.

## Smoke checks

- `/`, `/app` and `/api/health` load; `/app` redirects guests to sign-in.
- Guest data/image/paid-provider requests receive 401; unknown API routes return JSON.
- Sign in with an existing account and confirm its wardrobe and saved-fit calendar.
- Upload an item with **Keep original**, verify its image, edit metadata, and reload.
- Build an outfit with optional slots and save it without triggering a paid try-on.
- Upload a reference photo without generating a preview.
- Check mobile layout and console errors.
- Review the camera preview, but do not start metered Decart or OpenAI/Photoroom calls during routine smoke testing.

Automated tests mock paid providers and cover account isolation, upload finalization, large direct uploads, shared production middleware, saved snapshots and preview reuse. Actual live-generation quality and browser camera permissions still require an explicit user test when recording the demo.

## Demo preparation

Use an existing populated account. Start with the wardrobe filters and item count, show a weather-based suggestion, customize it in **Build a fit**, then save and revisit it in **Saved fits**. Open the free camera preview next. Start a short live try-on only when ready to record; stop it immediately afterwards. Photo preview generation can take several minutes, so prepare a cached preview before filming if you choose to include it. Do not show environment files, provider dashboards or account credentials in the recording.
