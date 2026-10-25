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

Choose, drop, or paste photos in the app. Use one item per photo. Preview it and choose **Remove background** or **Keep original**. Removal sends the photo to Photoroom only when clicked. Review the transparent result and choose **Use this image**, or **Restore original**. Then enter a name, select a category and primary color, and optionally add a secondary color and comma-separated details. Select **Save item** to add it to your collection. When adding multiple photos, complete each item's form in turn.

The app stores your uploaded photo as a PNG, preserving its contents and correcting camera orientation. Optional background removal produces a transparent PNG; it does not identify garments or create modeled photos. You can return to the photo step without losing your details. Failed removal can be retried or skipped. The item viewer displays the item photo.

Photos must be PNG, JPEG, or WebP, smaller than 18 MB and no larger than 40 megapixels. Saved items and photos stay in `data/library.json` and `data/imported/`. Unsaved forms last for the current page session.

## Daily suggestions

The Daily suggestions panel uses **Use my location** to request browser location permission and fetch weather from Open-Meteo. Location access requires HTTPS or localhost. Approximate coordinates are sent to the weather provider and are not saved by this app. Weather refreshes every 30 minutes while the page is open; use **Refresh location** after moving.

Suggestions use the current feels-like temperature (hot: 25°C or above; cool: below 15°C) and today's rain chance. The panel selects only existing clothing items using their categories, names, and details, with pictures ordered hat, top, jacket when needed, bottoms, shoes. Add specific names or details such as “T-shirt,” “shorts,” and “waterproof” for better matches. Missing categories are noted; matching is a simple rule-based starting point, not AI styling. Click a suggested photo to edit it, or try another combination of equally suitable pieces.

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
| `npm run build` | Build the frontend into `dist/`. |
| `npm run preview` | Serve the built app locally at `http://localhost:4173`. |
| `npm run check` | Run the production build check. |
| `npm test` | Run the outfit, import, try-on, and video-worker regression tests. |

Run `npm run build` before `npm run preview`.
