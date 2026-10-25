<div align="center">

# The Fit

A local-first clothing gallery with photo uploads, weather-based outfit suggestions, and optional AI try-on previews.

[![Node 22+](https://img.shields.io/badge/node-22%2B-191919?style=flat-square)](package.json)

</div>

![The Fit gallery](docs/screenshots/gallery.png)

## Quick start

Use Node.js 22 or newer and npm. Download or clone The Fit, then open a terminal in the project directory and run:

```bash
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173). No API key or reference photo is required.

To enable optional background removal or outfit try-on, copy the configuration template if you do not already have a `.env.local` file:

```bash
cp .env.example .env.local
```

Fill in the keys for the features you want to use, then restart the server. For try-on, also add your reference photo at `data/model-reference.png` or update the reference photo path in `.env.local` using the setting in `.env.example`.

## Add clothes

Choose, drop, or paste photos in the app. Use one item per photo. Preview it and choose **Remove background** or **Keep original**. Removal sends the photo to Photoroom only when clicked. Review the transparent result and choose **Use this image**, or **Restore original**. Then enter a name, select a category, specific garment type, and color, and optionally add comma-separated details. Select **Save item** to add it to your collection. When adding multiple photos, complete each item's form in turn.

Browse by **Tops**, **Outerwear**, **Bottoms**, **Footwear**, **Headwear**, or **Accessories**, then narrow a category by garment type (for example, puffer jackets, jeans, or loafers). The piece count reflects the selected filters, with the wardrobe total alongside it. Existing items infer their garment type from names/details until you explicitly save one; a saved garment type takes priority. Caps are headwear, while bags, belts, scarves, and gloves stay in Accessories and are not used as hats in recommendations.

The app stores your uploaded photo as a PNG, preserving its contents and correcting camera orientation. Optional background removal produces a transparent PNG; it does not identify garments or create modeled photos. You can return to the photo step without losing your details. Failed removal can be retried or skipped. The item viewer displays the item photo.

Photos must be PNG, JPEG, or WebP, smaller than 18 MB and no larger than 40 megapixels. Saved items and photos stay in `data/library.json` and `data/imported/`. Unsaved forms last for the current page session.

To load the bundled **41-piece sample wardrobe**, stop the app server and run `npm run seed:wardrobe`, then start it again. The import preserves existing items and edits and skips duplicate IDs. It uses no paid APIs. The 28 PNGimg stock photos require attribution and **noncommercial use**; see [the sample wardrobe and image credits](sample-wardrobe/README.md). Local uploads, API keys, and reference photos remain ignored by Git.

## Daily suggestions

The Daily suggestions panel uses **Use my location** to request browser location permission and fetch weather from Open-Meteo. Location access requires HTTPS or localhost. Approximate coordinates are sent to the weather provider and are not saved by this app. Weather refreshes every 30 minutes while the page is open; use **Refresh location** after moving.

Suggestions compare complete outfits using the current feels-like temperature, wind, and the next three forecast hours when available. Choose **Everyday**, **Smart casual**, or **Active / workout** to guide the look. Explicit garment types take priority, followed by inferred names/details and legacy categories, so a puffer accidentally labeled as a top cannot become a second jacket. Each outfit contains a base top, suitable bottoms and shoes, at most one outer layer, and optional weather-appropriate headwear.

Smart casual requires collared tops or simple knitwear, refined full-length bottoms (including undistressed dark jeans), and dress shoes, minimal sneakers, or dress boots. Hoodies, athletic shorts, running shoes, and work boots cannot fill smart casual slots. Active looks require easy-moving tops, athletic bottoms, and training shoes. Missing suitable clothing is reported instead of silently substituting an incompatible style. Weather rules still apply, and a functional outer layer may be needed over a smart casual base.

The local engine balances combined layer warmth, rain coverage, formality, and color harmony. Each piece has a short explanation; wardrobe gaps and inferred category corrections are shown. **Try another look** cycles through distinct combinations close to the best score without relaxing the weather rules. This uses descriptive metadata and transparent heuristics, not a vision model or measured clothing performance. Recommendations do not call OpenAI, Photoroom, or Decart. See [the algorithm notes](docs/outfit-recommendations.md) for the rules and limitations.

## Build your own outfit

Choose **Build a fit** beside **Suggested outfit**. All five slots—**Top**, **Bottoms**, **Footwear**, **Outerwear**, and **Headwear**—are optional. Tap a slot and then a piece in the filtered wardrobe. Selecting another piece replaces that slot; use the remove button to empty a slot or **Clear outfit** to start again. Desktop users can also drag a wardrobe piece into its matching slot. The pencil beside a garment still opens its editor.

The outfit board stays beside the gallery on desktop and appears above it on mobile. **View your fit** returns to the board after browsing. The draft stays on the current device, and edits to a selected garment are reflected automatically; deleted or reclassified garments leave their old slots empty. On a daily suggestion, **Customize this look** starts a draft from those pieces. Switching modes preserves the suggestion and custom draft separately.

Building or changing an outfit makes no paid API calls. Once at least one piece is selected, the existing live and photo try-on actions become available. Live first opens a free camera preview and still requires an explicit paid start. Photo generation starts only on its button, shares concurrent requests for the same look, and reuses the five most recent completed previews in memory until the page reloads.

Use **Save fit of the day** on a custom or suggested outfit to keep its selected pieces, the local calendar date, and any existing photo preview. Saving does not require a try-on and never calls a paid provider. **Saved fits** lists the dated looks; **Load in builder** restores available wardrobe pieces for editing or another try-on. Repeated saves of an unchanged outfit on the same day reuse the same record; another selection or date creates a separate entry. Saved garment snapshots remain viewable after an original wardrobe item is removed, and missing pieces are called out when restoring the fit.

Saved fits are local server data in `data/saved-outfits.json` and `data/saved-outfits/` (or the configured data directory), and remain ignored by Git. Back up the whole data directory to preserve this history. Loading an unchanged saved fit reuses its saved photo preview without regenerating it; changes to the selected pieces or their details invalidate that reuse. Live video is not recorded by the save action; it stores the selected garments and any already-generated photo preview.

## Preview an outfit on yourself

After getting a daily suggestion, click **Try this look on me**. Set `OPENAI_API_KEY` in `.env.local` and add your reference photo at `data/model-reference.png`, then restart the server. To use another local photo path, update the reference photo setting shown in `.env.example`. `OPENAI_IMAGE_MODEL` defaults to `gpt-image-2`; `OPENAI_IMAGE_QUALITY` defaults to `high`.

The button sends your reference photo and the suggested garment images to OpenAI's image-edit API. Generation can take a few minutes and uses your OpenAI API credits. The result appears below the outfit and can be downloaded. It is an AI visualization, not a measurement of actual fit. Changing the suggested pieces hides the previous preview. The server temporarily caches up to five results until restart, and does not modify your collection photos.

## Live camera try-on

With `DECART_API_KEY` set in `.env.local`, select **See this outfit live** in a weather-based suggestion. The app first opens a free local camera preview. Select **Start live try-on** to send the camera and outfit to Decart using a short-lived client token and standard-speed 720p Lucy VTON. The live session stops when you close the panel, select **Stop try-on**, or after 90 seconds. Missing or stalled video stops the session early to conserve credits; a connected session is only labeled live after the browser decodes a frame. Decart charges realtime usage by generated-video second. Drag or click **Full outfit** or a suggested piece to apply that selection. This feature does not call OpenAI or Photoroom.

## Configuration

Set these values in `.env.local` and restart the server after changes. API keys stay on the server; keep them out of source control.

| Variable | Purpose | Default |
| --- | --- | --- |
| `PHOTOROOM_API_KEY` | Enables the optional **Remove background** action. | Unset |
| `DECART_API_KEY` | Enables live camera outfit try-on. | Unset |
| `OPENAI_API_KEY` | Enables daily outfit try-on. | Unset |
| `OPENAI_IMAGE_MODEL` | Image model used for try-on. | `gpt-image-2` |
| `OPENAI_IMAGE_QUALITY` | Image quality requested for try-on. | `high` |

The template also includes `OPENAI_VISION_MODEL` for separately invoked AI workflows. The app's manual imports and daily outfit suggestions do not use a vision model.

Standard imports work without API keys. For background removal, processing copies are resized to at most 6,000 pixels per side and 25 megapixels; the original remains available until you save. Previewing or removing a background does not save a clothing entry.

Run the Vite dev or preview server for the local storage API; a static-only host cannot save uploads. Back up your data directory to preserve saved items and photos.

The bundled AI skills remain available for separately requested workflows, but the app does not invoke them or resume old generation jobs.

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server at `http://localhost:5173`. |
| `npm run seed:wardrobe` | Add the bundled sample wardrobe to local storage without replacing existing items. |
| `npm run build` | Build the frontend into `dist/`. |
| `npm run preview` | Serve the built app locally at `http://localhost:4173`. |
| `npm run check` | Run the production build check. |
| `npm test` | Run the outfit, import, try-on, and video-worker regression tests. |

Run `npm run build` before `npm run preview`.
