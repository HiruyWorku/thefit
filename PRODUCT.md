# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People organizing a personal wardrobe, choosing outfits, and previewing those outfits on themselves. The project owner and teammates use the app locally during development.

## Product Purpose

The Fit lets users browse their clothing, get weather-based outfit suggestions, build their own outfit, and explicitly start a photo or live-camera try-on.

## Operating Context

The existing React/Vite app stores garment metadata and transparent photos locally. Desktop and mobile web interactions must work. User-approved outfit building uses a wardrobe gallery beside a slot-based outfit board on desktop and a compact board above the gallery on mobile.

## Capabilities and Constraints

- Categories and specific garment types are shared by filtering, editing and recommendations.
- Custom outfits have five optional slots: top, bottoms, footwear, outerwear and headwear. At least one selected piece enables saving and try-on. Selecting another piece replaces that slot; suggestions can seed a custom outfit.
- Users can save a custom or suggested fit with its local date and an existing photo preview, then revisit it under Saved fits. Saving does not require a paid try-on.
- Building an outfit must not invoke paid APIs. OpenAI photo previews and Decart live try-on start only through explicit user actions. Photoroom background removal is separately requested.
- The existing live camera has a free local preview and an explicit paid start, capped at 90 seconds.
- API keys and runtime wardrobe storage stay out of Git. Bundled sample images include attribution and noncommercial restrictions.

## Evidence on Hand

The source code, local wardrobe, 41-piece sample wardrobe, and existing gallery screenshots provide actual content. No generated people or replacement garment assets are needed for the builder.

## Product Principles

- Give users direct control over the pieces they choose.
- Make paid actions deliberate and conserve API credits.
- Preserve existing wardrobe items and edits.
- Report missing pieces rather than disguising an incomplete outfit as complete.
- Support tapping and keyboard interaction; desktop drag-and-drop is an additional way to select clothing.
