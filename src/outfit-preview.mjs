const previews = new Map();
const pending = new Map();
let generation = 0;
export function clearOutfitPreviews() { generation++; previews.clear(); pending.clear(); }

export function outfitPreviewKey(outfit) {
  return JSON.stringify([generation, (outfit?.chosen || []).map(({ item }) => [item.id, item.name, item.part, item.garmentType, item.color, item.secondaryColor, item.tags, item.image])]);
}

export const cachedOutfitPreview = outfit => previews.get(outfitPreviewKey(outfit)) || null;

export function rememberOutfitPreview(outfit, image) {
  if (typeof image !== 'string' || !/^\/api\/outfits\/saved\/assets\/[a-f0-9-]{36}-preview\.png$/i.test(image)) return;
  if (previews.size >= 5) previews.delete(previews.keys().next().value);
  previews.set(outfitPreviewKey(outfit), image);
}

// Called only by the explicit photo-preview button. Building an outfit never
// invokes this function. Repeated clicks/mode switches share the same request.
export async function requestOutfitPreview(outfit, fetcher = fetch) {
  const ids = (outfit?.chosen || []).map(({ item }) => item.id);
  if (!ids.length || ids.length > 5 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    throw new Error('Choose between one and five unique wardrobe pieces.');
  }
  const key = outfitPreviewKey(outfit);
  const requestGeneration = generation;
  if (previews.has(key)) return previews.get(key);
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    const response = await fetcher('/api/outfits/try-on', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds: ids }),
    });
    const result = await response.json().catch(() => ({}));
    const image = result.imageUrl || result.imageDataUrl;
    if (!response.ok || !image) throw new Error(result.error || 'Could not generate your preview.');
    if (generation === requestGeneration) {
      if (previews.size >= 5) previews.delete(previews.keys().next().value);
      previews.set(key, image);
    }
    return image;
  })();
  pending.set(key, task);
  try { return await task; } finally { if (pending.get(key) === task) pending.delete(key); }
}
