import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const fail = message => new Error(message);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function json(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

// Read every source before the first cloud write. Files remain untouched.
export async function planLocalMigration(dataDir) {
  const items = await json(path.join(dataDir, 'library.json'), []);
  const fits = await json(path.join(dataDir, 'saved-outfits.json'), []);
  const attributions = await json(path.join(dataDir, 'catalog-attributions.json'), null);
  const attributionById = new Map((attributions?.items || []).map(item => [item.id, item]));
  const assets = new Map();
  const add = async (url, kind) => {
    const pattern = kind === 'items' ? /^\/api\/import\/library\/([\w-]+\.png)$/ : /^\/api\/outfits\/saved\/assets\/([a-f0-9-]{36}-(?:[0-4]|preview)\.png)$/;
    const filename = typeof url === 'string' && url.match(pattern)?.[1];
    if (!filename) throw fail('A local record contains an unsupported image path.');
    const name = `${kind}/${filename}`;
    if (!assets.has(name)) {
      const bytes = await readFile(path.join(dataDir, kind === 'items' ? 'imported' : 'saved-outfits', filename));
      if (bytes.length > 25 * 1024 * 1024) throw fail('A local image exceeds the private bucket size limit.');
      assets.set(name, { bytes, hash: digest(bytes) });
    }
  };
  if (new Set(items.map(item => item.id)).size !== items.length || new Set(fits.map(fit => fit.id)).size !== fits.length) throw fail('Duplicate local record IDs must be resolved before migration.');
  for (const item of items) {
    if (!/^[\w-]{1,100}$/.test(item.id)) throw fail('Invalid local garment ID.');
    for (const url of new Set([item.image, item.thumbnail, item.modeledImage].filter(Boolean))) await add(url, 'items');
  }
  for (const fit of fits) {
    if (!/^[a-f0-9-]{36}$/.test(fit.id) || !Array.isArray(fit.items) || !fit.items.length || fit.items.length > 5) throw fail('Invalid saved fit.');
    for (const item of fit.items) await add(item.image, 'fits');
    if (fit.previewImage) await add(fit.previewImage, 'fits');
  }
  const records = items.map(item => ({ ...item, ...(attributionById.has(item.id) ? { attribution: attributionById.get(item.id) } : {}) }));
  const hash = digest(JSON.stringify([records, fits, [...assets].map(([name, asset]) => [name, asset.hash])]));
  return { items: records, fits, assets, digest: hash, summary: { items: records.length, fits: fits.length, images: assets.size, bytes: [...assets.values()].reduce((total, asset) => total + asset.bytes.length, 0) } };
}

export async function migrateLocalData(plan, store, { expectedDigest, onProgress = async () => {} } = {}) {
  if (expectedDigest && plan.digest !== expectedDigest) throw fail('The local data changed after preparation. Prepare a fresh migration.');
  const existingItems = new Map((await store.listItems()).map(item => [item.id, item]));
  const existingFits = new Map((await store.listFits()).map(fit => [fit.id, fit]));
  // Existing account records win on ID conflicts. Never replace the user's newer edits.
  const required = new Set();
  for (const item of plan.items) if (!existingItems.has(item.id)) for (const url of [item.image, item.thumbnail, item.modeledImage].filter(Boolean)) required.add(`items/${url.split('/').pop()}`);
  for (const fit of plan.fits) if (!existingFits.has(fit.id)) {
    for (const item of fit.items) required.add(`fits/${item.image.split('/').pop()}`);
    if (fit.previewImage) required.add(`fits/${fit.previewImage.split('/').pop()}`);
  }
  let uploaded = 0, reused = 0;
  for (const name of required) {
    const asset = plan.assets.get(name);
    let present;
    try { present = await store.readImage(name); } catch (error) { if (error.status !== 404) throw error; }
    if (present) {
      if (digest(present) !== asset.hash) throw fail('An existing cloud image differs from the local image. No image was overwritten.');
      reused++;
    } else { await store.writeImage(name, asset.bytes); uploaded++; }
    // Verify the stored bytes before publishing any records that refer to them.
    if (!present && digest(await store.readImage(name)) !== asset.hash) throw fail('Cloud image verification failed. Local data is intact.');
    await onProgress({ uploaded, reused, images: required.size });
  }
  let importedItems = 0, importedFits = 0;
  for (const item of plan.items) if (!existingItems.has(item.id)) { await store.putItem(item); importedItems++; }
  for (const fit of plan.fits) if (!existingFits.has(fit.id)) {
    const fingerprint = fit.fingerprint || digest(JSON.stringify(fit));
    const byHash = await store.fitByFingerprint(fingerprint);
    if (byHash && byHash.id !== fit.id) throw fail('A saved fit conflicts with an existing account fit. The original local fit is intact.');
    await store.putFit({ ...fit, fingerprint }); importedFits++;
  }
  const cloudIds = new Set((await store.listItems()).map(item => item.id));
  const fitIds = new Set((await store.listFits()).map(fit => fit.id));
  if (plan.items.some(item => !cloudIds.has(item.id)) || plan.fits.some(fit => !fitIds.has(fit.id))) throw fail('Cloud record verification failed. Retry the migration to resume.');
  return { importedItems, importedFits, uploadedImages: uploaded, reusedImages: reused, verifiedItems: plan.items.length, verifiedFits: plan.fits.length };
}
