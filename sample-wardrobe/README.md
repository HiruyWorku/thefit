# Sample wardrobe

This snapshot contains 41 transparent garment photos and their wardrobe metadata: the 13 garments imported from the existing `Img/` collection and 28 stock garments sourced from PNGimg. It contains no API keys, model reference photos, or generated try-on results.

With the app server stopped, run `npm run seed:wardrobe` from the repository root, then start the app with `npm run dev`. The command copies missing sample items into the ignored local `data/` directory. Existing items and edits are preserved; repeating the command does not duplicate items. To use another data directory, pass `-- --data-dir /path/to/data` and configure the app to use that directory.

## Image licenses and attribution

The 28 PNGimg photos are licensed under **Creative Commons Attribution–NonCommercial 4.0 International (CC BY-NC 4.0)**. Their use and redistribution require attribution and are limited to noncommercial purposes. These image assets are not covered by the project's MIT code license.

- Source: [PNGimg clothing catalog](https://pngimg.com/images/clothing)
- Publisher's license notice: <https://pngimg.com/license>
- License terms: <https://creativecommons.org/licenses/by-nc/4.0/>
- Per-image source pages, titles, download URLs, and changes: [catalog-attributions.json](catalog-attributions.json)

The stock images are unchanged except that the grey and black trucker cap was converted from grayscale with alpha to RGBA. Its visual contents and transparency are preserved. The original 13 garment photos come from the repository's existing `Img/` collection; no additional license grant is asserted for those images.
