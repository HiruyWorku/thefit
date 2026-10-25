# Outfit recommendations

The recommendation engine runs locally. It estimates what works together from garment names, tags, category, and primary color. It does not inspect photos, measure insulation, or verify waterproofing. The existing Open-Meteo weather request supplies conditions; changing styles and shuffling do not make provider calls.

## Selection order

1. Infer garment roles from recognizable names and details, falling back to the saved category. A puffer is outerwear even if its saved category is Tops. Low-top sneakers remain shoes. Bags never become hats. Category disagreements are reported without modifying saved items.
2. Reject unsuitable combinations before scoring: one item per slot, unique IDs, a genuine top, at most one jacket, no shorts or open shoes below 14°C, no open shoes in rain, no heavy knit tops at 25°C or above, and no heavy outerwear at 22°C or above. Unavailable suitable slots are reported rather than filled with the wrong garment.
3. Score complete outfits for combined top-and-jacket warmth, rain protection, occasion, pairwise formality, and color balance. Weather suitability has more influence than styling. Color is a soft preference: neutrals and related colors are useful anchors; multiple competing bright colors and patterns receive small penalties.
4. Keep distinct alternatives within four score points of the best complete look. Prefer alternatives that change several pieces. The same wardrobe, date, weather, occasion, and variation produce the same result regardless of input ordering. At most twelve alternatives are exposed.

Warmth scores are relative heuristics: a short-sleeve top is 0.7, a warm sweater is 2.4, a shell is 0.9, and an insulated puffer is 3.5. The target for the upper-body combination ranges from 0.7 in hot weather to 6 in freezing conditions. Missing warmth costs more than a similar excess of warmth. These scores do not represent clo measurements.

Named rain shells receive an inferred rain-suitability score; explicit waterproof and water-resistant tags carry stronger evidence. Ordinary leather or closed shoes are not described as waterproof. If the best available clothing lacks warm layers or rain protection, the result includes that limitation.

## Weather window

The request asks for six hourly time steps. The parser takes the next three valid hours using the provider's local timestamps, including across midnight. Selection uses the colder of current and near-term feels-like temperatures and the largest near-term rain probability. Current precipitation always counts. Daily rain chance is the fallback when hourly probabilities are missing; the overnight daily low does not force a coat at midday. Wind can favor a shell, but wind chill is not subtracted again from feels-like temperature.

## Cost and scale

A bounded beam search keeps up to 96 partial looks and 24 candidates per slot. That bounds work for larger wardrobes while considering combinations instead of choosing each piece independently. It is approximate, not an exhaustive global optimizer. No personal preference is learned silently: the chosen occasion is explicit, and recommendation inputs are recomputed when item metadata changes.

The tests cover category mistakes, duplicate IDs, cold and hot conditions, rain, wind, forecast transitions, style compatibility, color preferences, deterministic variety, missing clothing, and invalid optional metadata.
