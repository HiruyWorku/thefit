export function localOutfitDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function saveFitOfDay(outfit, { previewDataUrl = null, date = localOutfitDate(), fetcher = fetch } = {}) {
  const itemIds = (outfit?.chosen || []).map(({ item }) => item.id);
  if (!itemIds.length || itemIds.length > 5 || itemIds.some(id => typeof id !== 'string') || new Set(itemIds).size !== itemIds.length) throw new Error('Choose at least one wardrobe piece before saving.');
  if (previewDataUrl?.startsWith('/')) {
    if (!/^\/api\/outfits\/saved\/assets\/[a-f0-9-]{36}-preview\.png$/i.test(previewDataUrl)) throw new Error('Choose a valid saved photo preview.');
    const photo = await fetcher(previewDataUrl);
    if (!photo.ok) throw new Error('Could not read the saved preview. Please try again.');
    const bytes = new Uint8Array(await photo.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    previewDataUrl = `data:image/png;base64,${btoa(binary)}`;
  }
  const response = await fetcher('/api/outfits/saved', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds, date, previewDataUrl }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) throw new Error(result.error || 'Could not save your fit. Please try again.');
  return result;
}

export function savedPreviewMatches(fit, outfit) {
  if (!fit.previewImage || fit.items.length !== outfit.chosen.length) return false;
  return fit.items.every(saved => {
    const item = outfit.chosen.find(entry => entry.item.id === saved.id)?.item;
    return item && saved.sourceImage === item.image && JSON.stringify([saved.name, saved.part, saved.garmentType || null, saved.color || null, saved.secondaryColor || null, saved.tags || []])
      === JSON.stringify([item.name, item.part, item.garmentType || null, item.color || null, item.secondaryColor || null, item.tags || []]);
  });
}

export function fitDateLabel(date) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}
