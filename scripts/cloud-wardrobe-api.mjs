import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { CATEGORIES, validGarmentType } from '../src/garment-types.mjs';
import { builderSlotFor } from '../src/outfit-builder.mjs';
import { cloudWardrobeStore } from './cloud-wardrobe-store.mjs';
import { sendJson } from './account-api.mjs';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const parts = new Set(CATEGORIES.map(item => item.id));
const hex = /^#[a-f0-9]{6}$/i;
const ROOT = '/api/outfits/saved';
const PREVIEWS = '/api/outfits/previews/';
async function inputBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 45 * 1024 * 1024) throw fail('Choose a smaller image.', 413); chunks.push(Buffer.from(chunk)); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail('Expected a JSON request.'); }
}
export function garmentMetadata(value = {}, existing = {}) {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120 || !parts.has(value.part) || !validGarmentType(value.part, value.garmentType) || !hex.test(value.color) || (value.secondaryColor && !hex.test(value.secondaryColor))) throw fail('Enter a name, matching category and garment type, and valid colors.');
  return { ...existing, name: value.name.trim(), part: value.part, garmentType: value.garmentType || null,
    color: value.color.toLowerCase(), secondaryColor: value.secondaryColor?.toLowerCase() || null,
    palette: [value.color, value.secondaryColor].filter(Boolean).map(color => color.toLowerCase()),
    tags: Array.isArray(value.tags) ? value.tags.filter(tag => typeof tag === 'string').map(tag => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 12) : [],
  };
}
async function png(value, pngOnly = false) {
  const match = typeof value === 'string' && value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match || (pngOnly && match[1] !== 'png')) throw fail('Choose a valid PNG, JPEG or WebP photo.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 24 * 1024 * 1024) throw fail('Choose a photo smaller than 24 MB.', 413);
  try { return await sharp(bytes, { limitInputPixels: 40000000 }).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).png().toBuffer(); }
  catch { throw fail('This photo could not be read. Choose an image under 40 megapixels.'); }
}
async function uploadedPng(store, name, kind) {
  const pattern = kind === 'items' ? /^items\/import-[a-f0-9-]{36}-garment\.png$/ : /^reference\/[a-f0-9-]{36}\.png$/;
  if (typeof name !== 'string' || !pattern.test(name)) throw fail('Choose a valid private photo.');
  const bytes = await store.readImage(name);
  try {
    const photo = sharp(bytes, { limitInputPixels: 40000000 });
    if (bytes.length > 25 * 1024 * 1024 || (await photo.metadata()).format !== 'png') throw new Error();
    await photo.stats();
  } catch { throw fail('This private photo is invalid. Please upload it again.'); }
  return bytes;
}
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export function cloudWardrobeApi({ storeFactory = cloudWardrobeStore } = {}) {
  const writes = new Map();
  async function mutate(userId, action) {
    const previous = writes.get(userId) || Promise.resolve();
    const result = previous.catch(() => {}).then(action);
    writes.set(userId, result);
    try { return await result; } finally { if (writes.get(userId) === result) writes.delete(userId); }
  }
  async function handler(req, res, next) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!(pathname.startsWith('/api/import/') && pathname !== '/api/import/remove-background') && !pathname.startsWith(ROOT) && !pathname.startsWith(PREVIEWS) && !pathname.startsWith('/api/account/reference')) return next();
    if (!req.account) return sendJson(res, 401, { error: 'Log in to access your wardrobe.' });
    const store = storeFactory(req.account);
    const image = async name => {
      const location = await store.imageUrl(name);
      res.statusCode = 302; res.setHeader('Location', location); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.end();
    };
    try {
      const asset = pathname.match(/^\/api\/import\/library\/([\w-]+\.png)$/);
      if (asset && req.method === 'GET') return await image(`items/${asset[1]}`);
      const fitAsset = pathname.match(/^\/api\/outfits\/saved\/assets\/([a-f0-9-]{36}-(?:[0-4]|preview)\.png)$/);
      if (fitAsset && req.method === 'GET') return await image(`fits/${fitAsset[1]}`);
      const generatedPreview = pathname.match(/^\/api\/outfits\/previews\/([a-f0-9]{64}\.png)$/);
      if (generatedPreview && req.method === 'GET') return await image(`previews/${generatedPreview[1]}`);
      if (pathname === '/api/account/reference/image' && req.method === 'GET') {
        const name = await store.reference();
        if (!name) throw fail('Upload your try-on reference photo first.', 404);
        return await image(name);
      }
      if (pathname === '/api/account/reference' && req.method === 'GET') return sendJson(res, 200, { configured: !!(await store.reference()) });
      if (pathname === '/api/account/reference' && req.method === 'POST') {
        const input = await inputBody(req);
        const bytes = input.imagePath ? await uploadedPng(store, input.imagePath, 'reference') : await png(input.imageDataUrl);
        await mutate(req.account.userId, async () => {
          const old = await store.reference(); const name = input.imagePath || `reference/${randomUUID()}.png`;
          if (!input.imagePath) await store.writeImage(name, bytes);
          try { await store.setReference(name); } catch (error) { if (!input.imagePath) await store.removeImages([name]).catch(() => {}); throw error; }
          if (old && old !== name) await store.removeImages([old]).catch(() => {});
        });
        return sendJson(res, 200, { configured: true });
      }
      if (pathname === '/api/import/wardrobe' && req.method === 'GET') return sendJson(res, 200, await store.listItems());
      if (pathname === '/api/import/wardrobe' && req.method === 'POST') {
        const input = await inputBody(req);
        const metadata = garmentMetadata(input.metadata);
        const photo = input.imagePath ? await uploadedPng(store, input.imagePath, 'items') : await png(input.imageDataUrl);
        const filename = input.imagePath ? input.imagePath.slice('items/'.length) : `import-${randomUUID()}-garment.png`;
        const id = filename.slice(0, -'-garment.png'.length);
        const record = { ...metadata, id, image: `/api/import/library/${filename}`, thumbnail: `/api/import/library/${filename}`, modeledImage: null };
        const existing = await store.item(id);
        if (existing) return sendJson(res, 200, existing);
        if (!input.imagePath) await store.writeImage(`items/${filename}`, photo);
        try { await store.putItem(record); } catch (error) { await store.removeImages([`items/${filename}`]).catch(() => {}); throw error; }
        return sendJson(res, 201, record);
      }
      const itemPath = pathname.match(/^\/api\/import\/wardrobe\/([\w-]{1,100})$/);
      if (itemPath && ['PATCH', 'DELETE'].includes(req.method)) {
        const input = req.method === 'PATCH' ? await inputBody(req) : null;
        const result = await mutate(req.account.userId, async () => {
          const existing = await store.item(itemPath[1]);
          if (!existing) throw fail('Item not found in your wardrobe.', 404);
          if (req.method === 'PATCH') return store.putItem(garmentMetadata(input.metadata, existing));
          await store.deleteItem(existing.id);
          const filename = existing.image?.match(/^\/api\/import\/library\/([\w-]+\.png)$/)?.[1];
          if (filename) await store.removeImages([`items/${filename}`]).catch(() => {});
          return { deleted: true, id: existing.id };
        });
        return sendJson(res, 200, result);
      }
      if (pathname === ROOT && req.method === 'GET') return sendJson(res, 200, await store.listFits());
      if (pathname === ROOT && req.method === 'POST') {
        const input = await inputBody(req); const ids = input.itemIds;
        if (!Array.isArray(ids) || !ids.length || ids.length > 5 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length || !validDate(input.date)) throw fail('Choose one to five unique pieces and a valid date.');
        let preview = input.previewDataUrl == null ? null : await png(input.previewDataUrl, true);
        if (input.previewImage) {
          const saved = typeof input.previewImage === 'string' && input.previewImage.match(/^\/api\/outfits\/saved\/assets\/([a-f0-9-]{36}-preview\.png)$/);
          const generated = typeof input.previewImage === 'string' && input.previewImage.match(/^\/api\/outfits\/previews\/([a-f0-9]{64}\.png)$/);
          if (!saved && !generated) throw fail('Choose a valid private preview.');
          preview = await store.readImage(saved ? `fits/${saved[1]}` : `previews/${generated[1]}`);
        }
        const result = await mutate(req.account.userId, async () => {
          const records = await Promise.all([...ids].sort().map(id => store.item(id)));
          if (records.some(item => !item)) throw fail('A selected piece is not in your wardrobe.', 404);
          const roles = records.map(builderSlotFor);
          if (roles.some(role => !role) || new Set(roles).size !== roles.length) throw fail('Choose one piece per outfit slot.');
          const photos = await Promise.all(records.map(item => {
            const filename = item.image?.match(/^\/api\/import\/library\/([\w-]+\.png)$/)?.[1];
            if (!filename) throw fail('This piece has no supported wardrobe photo.');
            return store.readImage(`items/${filename}`);
          }));
          const hash = createHash('sha256').update(JSON.stringify([input.date, records]));
          photos.forEach(bytes => hash.update(bytes)); const fingerprint = hash.digest('hex');
          const existing = await store.fitByFingerprint(fingerprint);
          if (existing && (!preview || existing.previewImage)) return { status: 200, fit: existing };
          const id = existing?.id || randomUUID(); const written = [];
          try {
            const snapshots = existing?.items || [];
            if (!existing) for (const [index, item] of records.entries()) {
              const filename = `${id}-${index}.png`;
              await store.writeImage(`fits/${filename}`, photos[index]); written.push(`fits/${filename}`);
              snapshots.push({ id: item.id, name: item.name, part: item.part, garmentType: item.garmentType || null, color: item.color, secondaryColor: item.secondaryColor || null, tags: item.tags || [], sourceImage: item.image, image: `${ROOT}/assets/${filename}`, thumbnail: `${ROOT}/assets/${filename}` });
            }
            let previewImage = existing?.previewImage || null;
            if (preview && !previewImage) {
              const filename = `${id}-preview.png`;
              await store.writeImage(`fits/${filename}`, preview); written.push(`fits/${filename}`);
              previewImage = `${ROOT}/assets/${filename}`;
            }
            const fit = { id, date: input.date, createdAt: existing?.createdAt || new Date().toISOString(), fingerprint, items: snapshots, previewImage };
            await store.putFit(fit); return { status: existing ? 200 : 201, fit };
          } catch (error) { await store.removeImages(written).catch(() => {}); throw error; }
        });
        return sendJson(res, result.status, result.fit);
      }
      return sendJson(res, 404, { error: 'Not found.' });
    } catch (error) { return sendJson(res, error.status || 500, { error: error.status ? error.message : 'Could not access your wardrobe. Please try again.' }); }
  }
  return { name: 'cloud-wardrobe-api', configureServer(server) { server.middlewares.use(handler); }, configurePreviewServer(server) { server.middlewares.use(handler); } };
}
