import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { builderSlotFor } from '../src/outfit-builder.mjs';

const ROOT = '/api/outfits/saved';
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const json = (res, status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(value)); };
async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
async function inputBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 45 * 1024 * 1024) throw fail('This preview is too large to save.', 413); chunks.push(Buffer.from(chunk)); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail('Expected a JSON request.'); }
}
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export function savedOutfitsApi({ env = {} } = {}) {
  let dataDir;
  let savedDir;
  let savedFile;
  let writes = Promise.resolve();
  const mutate = operation => { const result = writes.then(operation); writes = result.catch(() => {}); return result; };
  async function saveIndex(rows) {
    const temporary = `${savedFile}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(rows, null, 2)}\n`);
    await rename(temporary, savedFile);
  }
  async function handler(req, res, next) {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== ROOT && !url.pathname.startsWith(`${ROOT}/`)) return next();
    try {
      const asset = url.pathname.match(/^\/api\/outfits\/saved\/assets\/([a-f0-9-]{36}-(?:[0-4]|preview)\.png)$/i);
      if (asset && req.method === 'GET') {
        const bytes = await readFile(path.join(savedDir, asset[1]));
        res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'private, max-age=31536000, immutable'); return res.end(bytes);
      }
      if (url.pathname !== ROOT) return json(res, 404, { error: 'Saved fit not found.' });
      if (req.method === 'GET') return json(res, 200, await readJson(savedFile, []));
      if (req.method !== 'POST') return json(res, 405, { error: 'Use GET or POST.' });
      const input = await inputBody(req);
      const ids = input?.itemIds;
      if (!Array.isArray(ids) || !ids.length || ids.length > 5 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length || !validDate(input.date)) throw fail('Choose one to five unique pieces and a valid date.');
      const library = await readJson(path.join(dataDir, 'library.json'), []);
      const records = ids.map(id => library.find(item => item.id === id));
      if (records.some(item => !item)) throw fail('A selected piece no longer exists. Refresh the wardrobe before saving.', 404);
      const roles = records.map(builderSlotFor);
      if (roles.some(role => !role) || new Set(roles).size !== roles.length) throw fail('Choose one piece per outfit slot.');
      const photos = await Promise.all(records.map(async item => {
        const match = item.image?.match(/^\/api\/import\/library\/([\w-]+\.png)$/);
        if (!match) throw fail('This piece has no supported wardrobe photo.');
        return readFile(path.join(dataDir, 'imported', match[1]));
      }));
      let preview = null;
      if (input.previewDataUrl !== null && input.previewDataUrl !== undefined) {
        const match = typeof input.previewDataUrl === 'string' && input.previewDataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)$/);
        if (!match) throw fail('The photo preview could not be read. Save this fit without the preview or try again.');
        preview = Buffer.from(match[1], 'base64');
        try {
          const image = sharp(preview, { limitInputPixels: 16000000 });
          if ((await image.metadata()).format !== 'png') throw new Error('Not a PNG');
          await image.stats();
        } catch { throw fail('The photo preview is invalid. Save this fit without the preview or try again.'); }
      }
      const hash = createHash('sha256').update(JSON.stringify([input.date, records]));
      for (const bytes of photos) hash.update(bytes);
      const fingerprint = hash.digest('hex');
      const result = await mutate(async () => {
        const rows = await readJson(savedFile, []);
        const existing = rows.find(row => row.fingerprint === fingerprint);
        if (existing && (!preview || existing.previewImage)) return { status: 200, fit: existing };
        const id = existing?.id || randomUUID();
        const written = [];
        try {
          await mkdir(savedDir, { recursive: true });
          const snapshots = existing?.items || [];
          if (!existing) for (const [index, item] of records.entries()) {
            const filename = `${id}-${index}.png`;
            const destination = path.join(savedDir, filename);
            written.push(destination); await writeFile(destination, photos[index]);
            snapshots.push({ id: item.id, name: item.name, part: item.part, garmentType: item.garmentType || null, color: item.color || null, secondaryColor: item.secondaryColor || null, tags: item.tags || [], sourceImage: item.image, image: `${ROOT}/assets/${filename}`, thumbnail: `${ROOT}/assets/${filename}` });
          }
          let previewImage = existing?.previewImage || null;
          if (preview && !previewImage) {
            const filename = `${id}-preview.png`;
            const destination = path.join(savedDir, filename);
            written.push(destination); await writeFile(destination, preview);
            previewImage = `${ROOT}/assets/${filename}`;
          }
          const fit = { ...existing, id, date: input.date, createdAt: existing?.createdAt || new Date().toISOString(), fingerprint, items: snapshots, previewImage };
          const nextRows = existing ? rows.map(row => row.id === id ? fit : row) : [fit, ...rows];
          await saveIndex(nextRows);
          return { status: existing ? 200 : 201, fit };
        } catch (error) { await Promise.all(written.map(file => rm(file, { force: true }).catch(() => {}))); throw error; }
      });
      return json(res, result.status, result.fit);
    } catch (error) {
      return json(res, error.status || (error.code === 'ENOENT' ? 404 : 500), { error: error.status ? error.message : error.code === 'ENOENT' ? 'A wardrobe or saved photo could not be found. Refresh and try again.' : 'Could not save your fit. Please try again.' });
    }
  }
  return { name: 'saved-outfits', apply: 'serve', configResolved(config) {
    dataDir = path.resolve(config.root, env.WARDROBE_DATA_DIR || process.env.WARDROBE_DATA_DIR || 'data');
    savedDir = path.join(dataDir, 'saved-outfits'); savedFile = path.join(dataDir, 'saved-outfits.json');
  }, configureServer(server) { server.middlewares.use(handler); }, configurePreviewServer(server) { server.middlewares.use(handler); } };
}
