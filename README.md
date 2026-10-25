<div align="center">

# Wardrobe

Your clothes, photographed and organized by you.

[![License: MIT](https://img.shields.io/badge/license-MIT-191919?style=flat-square)](LICENSE)
[![Node 22+](https://img.shields.io/badge/node-22%2B-191919?style=flat-square)](package.json)

[See the original post →](https://x.com/cdngdev/status/2076812846793650485)

</div>

![Wardrobe gallery](docs/screenshots/gallery.png)

## Quick start

```bash
git clone https://github.com/tandpfun/wardrobe.git
cd wardrobe
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173). No API key or reference photo is required.

## Add clothes

Choose, drop, or paste photos in the app. Use one item per photo. Preview it and choose **Remove background** or **Keep original**. Removal sends the photo to Photoroom only when clicked. Review the transparent result and choose **Use this image**, or **Restore original**. Then enter a name, select a category and primary color, and optionally add a secondary color and comma-separated details. Select **Save item** to add it to your wardrobe. When adding multiple photos, complete each item's form in turn.

The app stores your uploaded photo as a PNG, preserving its contents and correcting camera orientation. Optional background removal produces a transparent PNG; it does not identify garments or create modeled photos. You can return to the photo step without losing your details. Failed removal can be retried or skipped. The item viewer displays the item photo.

Photos must be PNG, JPEG, or WebP, smaller than 18 MB and no larger than 40 megapixels. Saved items and photos stay in `data/library.json` and `data/imported/`. Unsaved forms last for the current page session.

## Daily suggestions

The Daily suggestions panel uses **Use my location** to request browser location permission and fetch weather from Open-Meteo. Location access requires HTTPS or localhost. Approximate coordinates are sent to the weather provider and are not saved by this app. Weather refreshes every 30 minutes while the page is open; use **Refresh location** after moving.

Suggestions use the current feels-like temperature (hot: 25°C or above; cool: below 15°C) and today's rain chance. The panel selects only existing wardrobe items using their categories, names, and details, with pictures ordered hat, top, jacket when needed, bottoms, shoes. Add specific names or details such as “T-shirt,” “shorts,” and “waterproof” for better matches. Missing categories are noted; matching is a simple rule-based starting point, not AI styling. Click a suggested photo to edit it, or try another combination of equally suitable pieces.

## Preview an outfit on yourself

After getting a daily suggestion, click **Try this look on me**. Set `OPENAI_API_KEY` and `WARDROBE_MODEL_REFERENCE` (default `data/model-reference.png`) in `.env.local`, then restart the server. `OPENAI_IMAGE_MODEL` defaults to `gpt-image-2`; `OPENAI_IMAGE_QUALITY` defaults to `high`.

The button sends your reference photo and the suggested garment images to OpenAI's image-edit API. Generation can take a few minutes and uses your OpenAI API credits. The result appears below the outfit and can be downloaded. It is an AI visualization, not a measurement of actual fit. Changing the suggested pieces hides the previous preview. The server temporarily caches up to five results until restart, and does not modify your wardrobe photos.

## Configuration

To enable background removal, set `PHOTOROOM_API_KEY` in `.env` or `.env.local` and restart the dev server. The key stays on the server. Standard imports work without it. Processing copies are resized to at most 6,000 pixels per side and 25 megapixels; the original remains available until you save. Previewing or removing a background does not save a wardrobe entry.

`WARDROBE_DATA_DIR` optionally changes the storage directory (default: `data`). Run the Vite dev or preview server for the local storage API; a static-only host cannot save uploads.

The bundled AI skills remain available for separately requested workflows, but the app does not invoke them or resume old generation jobs.

## License

[MIT](LICENSE)
