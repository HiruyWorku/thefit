# thefit

A private wardrobe app with weather-based outfit suggestions, a custom outfit builder, a saved-fit calendar, and optional live and photo try-on.

## Features

- **Your wardrobe:** upload PNG, JPEG or WebP photos, optionally remove backgrounds, and organize items by category, garment type, color and details.
- **Daily outfits:** choose Everyday, Smart casual or Active / workout. The local recommendation engine balances weather, garment roles, formality, warmth and color without calling an AI API.
- **Build a fit:** choose any combination of top, bottoms, footwear, outerwear and headwear. All five slots are optional. Tap to select or drag pieces into matching slots on desktop.
- **Outfit calendar:** save suggested or custom looks with garment snapshots and an existing photo preview. Revisit them by date or load them back into the builder.
- **Live mirror:** preview your camera for free, then explicitly start a Decart live try-on with a 90-second limit.
- **Photo previews:** upload your own reference photo and explicitly generate an OpenAI outfit visualization.

Sign-in is required. Garments, photos, reference photos, previews and saved fits belong to the signed-in account in Supabase. New accounts start with an empty wardrobe.

## Run locally

Use **Node.js 24** and npm.

```bash
npm ci
cp .env.example .env.local
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the ignored env file. Apply [the Supabase migration](supabase/migrations/202610250001_private_wardrobe.sql) in that project's SQL Editor, and allow your local app URL in Supabase's Auth URL configuration.

```bash
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173), create an account, confirm your email if required, and sign in. Use the same hostname consistently: `localhost` and `127.0.0.1` have separate browser sessions.

The landing page is `/`; your protected wardrobe is `/app`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Required public Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Required public Supabase browser key. |
| `PHOTOROOM_API_KEY` | Optional server key for **Remove background**. |
| `DECART_API_KEY` | Optional server key for live try-on. |
| `OPENAI_API_KEY` | Optional server key for photo try-on. |
| `OPENAI_IMAGE_MODEL` | Photo model; defaults to `gpt-image-2`. |
| `OPENAI_IMAGE_QUALITY` | Photo quality; defaults to `high`. |
| `APP_HTTPS` | Set to `true` on Vercel so session cookies are Secure. |

Restart the local server after changing configuration. Permanent AI keys must never use a `VITE_` prefix. Database connection credentials are only needed for the optional migration CLI, never for the browser or normal deployed app.

## Privacy and API usage

Supabase Row Level Security restricts metadata and bucket objects to their owner. The app verifies sessions on the server and uses HttpOnly cookies. Photos upload directly to the private bucket; image requests redirect to short-lived, signed download URLs. Private APIs and images are not stored in the service-worker cache.

Adding clothes, recommendations, building outfits, saving fits and viewing the local camera do not invoke paid AI providers. Photoroom runs only after **Remove background**. OpenAI runs only after **Try this look on me**. Decart starts only after **Start live try-on** and stops on close, manual stop, timeout or stalled video.

Photo previews are saved privately and reused for the same garments, metadata, reference photo, model and quality, including after a server restart. Changing those inputs creates a new preview request. AI previews are visualizations; they do not measure fit. Live video is not recorded.

Location is optional. With your permission, approximate coordinates are sent to Open-Meteo for weather; the app does not save them.

## Deploy to Vercel

The repository includes `vercel.json` and a Node function in `api/index.mjs`. The same API middleware runs locally and in production. Uploads bypass Vercel's request-body limit by going directly to Supabase; saved fits and previews pass small private object paths instead of image payloads.

1. Link this repository to a Vercel project using the Vite preset.
2. Configure the required Supabase variables and optional AI keys in Vercel's **Production** environment; set `APP_HTTPS=true`.
3. Set Supabase's Site URL to the production origin and add `https://your-domain/app` to its allowed redirect URLs. Keep local redirects if developing locally.
4. Run `npm run check`, commit and push, then deploy with `vercel --prod`.
5. Verify `/api/health`, sign-in, private image loading, an upload and the outfit calendar.

A static-only host cannot run the authenticated APIs. Local files, environment files, migrated account data and one-time migration capabilities are excluded from deployment and Git.

See [deployment notes](docs/deployment.md) and [account/storage setup](docs/authentication.md).

## Development and documentation

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local app and protected APIs. |
| `npm test` | Run regression tests with mocked paid providers. |
| `npm run build` | Build the frontend into `dist/`. |
| `npm run check` | Run all tests and the production build. |
| `npm run preview` | Serve the built frontend and protected APIs locally. |
| `npm run db:setup` | Apply the SQL migration using an optional server-only database URL. |
| `npm run seed:wardrobe` | Legacy local sample-data utility; does not populate cloud accounts. |

- [Recommendation algorithm](docs/outfit-recommendations.md)
- [Outfit builder and calendar](docs/outfit-builder.md)
- [Private accounts and storage](docs/authentication.md)
- [Deployment and verification](docs/deployment.md)

The bundled [sample wardrobe](sample-wardrobe/README.md) includes image credits. PNGimg assets are **CC BY-NC 4.0** and require attribution and noncommercial use. Migration preserves their attribution metadata. Local backups are not automatically shared with new accounts.

Application code is MIT licensed; third-party image licenses are separate.
