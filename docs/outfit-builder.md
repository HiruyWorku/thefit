# Custom outfit builder

The user approved a builder alongside suggested outfits: a wardrobe gallery on the left and an outfit board on the right on desktop, with the board above the gallery on mobile. This extends the existing ivory, dark-ink interface and garment photography; it does not replace the visual identity.

The main task is to select any combination of top, bottoms, footwear, outerwear and headwear, then explicitly save or try on the result. All five slots are optional, with at least one piece needed to save or try on. Tapping a slot filters the wardrobe. Tapping a garment fills its matching slot, and desktop drag-and-drop offers the same selection. Each piece can be removed or edited independently. “Customize this look” copies the current suggestion into the builder. Draft IDs are kept on this device, while current wardrobe records remain the source of images and metadata.

The board must make optional slots, the active selection and readiness for try-on clear. Replacements, deleted garments, stale drafts, invalid drops, empty categories, storage failure and loading errors must leave a usable selection flow. Building, restoring and saving make no paid API calls. Camera preview and paid start retain their existing separation.

“Save fit of the day” is shared by suggested and custom outfits. It stores a dated snapshot of the selected garments and an already-generated photo preview when available. Saved fits remain local server data under the ignored data directory. Snapshot copies keep history viewable after a wardrobe deletion; restoring uses current wardrobe IDs and reports unavailable pieces. The same outfit/date is idempotent, and an existing saved fit can gain a later photo preview without duplication. Saved fits can be browsed and loaded back into the builder.

Saved fits now use a monthly calendar. Days with saved looks have a thumbnail and count; selecting a date shows that day's looks. Month arrows, Today and keyboard day/week/month navigation work across month and year boundaries. The landing page and optional Supabase profile session wrap the `/app` wardrobe route; saved garment data remains local.

Verification covers the desktop and mobile layouts, keyboard/tap selection, category counts, replacement/removal/clear, persistence, deleted or reclassified garments, copying a suggestion and the exact item IDs sent by an explicit preview request. Paid providers are mocked in tests and are not called during UI verification.
