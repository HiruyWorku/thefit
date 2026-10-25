import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const LIBRARY_ASSET_ROOT = "/api/import/library";
const PARTS = new Set(["upperbody", "wholebody_up", "lowerbody", "accessories_up", "shoes"]);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

async function body(req, limit = 25 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Request body too large"), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Expected a JSON request body"), { status: 400 }); }
}

// Only explicit background-removal requests send photos to Photoroom.
export function wardrobeImportApi(options = {}) {
  let importedFile;
  let libraryAssetDir;
  let writes = Promise.resolve();
  const mutate = (operation) => {
    const result = writes.then(operation);
    writes = result.catch(() => {});
    return result;
  };
  async function loadImported() {
    try { return JSON.parse(await readFile(importedFile, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return []; throw error; }
  }
  async function saveImported(records) {
    const temporary = `${importedFile}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(records, null, 2));
    await rename(temporary, importedFile);
  }
  async function handler(req, res, next) {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/import/")) return next();
    try {
      if (url.pathname === "/api/import/remove-background" && req.method === "POST") {
        const key = options.env?.PHOTOROOM_API_KEY || process.env.PHOTOROOM_API_KEY;
        if (!key?.trim()) return json(res, 503, { error: "Background removal is not configured. Add PHOTOROOM_API_KEY and restart the server, or keep the original." });
        const input = await body(req);
        const match = typeof input.imageDataUrl === "string" && input.imageDataUrl.match(/^data:image\/(?:png|jpeg|webp);base64,(.+)$/s);
        if (!match) return json(res, 400, { error: "Choose a PNG, JPEG, or WebP photo." });
        const bytes = Buffer.from(match[1], "base64");
        if (bytes.length > 18 * 1024 * 1024) return json(res, 413, { error: "Choose a photo smaller than 18 MB." });
        let photo;
        try {
          const source = sharp(bytes, { limitInputPixels: 40000000 });
          const { width, height } = await source.metadata();
          const scale = Math.min(1, 6000 / Math.max(width, height), Math.sqrt(25000000 / (width * height)));
          // A square bounding box is orientation-independent after auto-rotation.
          const edge = Math.max(1, Math.floor(Math.max(width, height) * scale));
          photo = await source.rotate().resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true }).png().toBuffer();
        } catch { return json(res, 400, { error: "Choose a valid photo no larger than 40 megapixels." }); }
        if (photo.length > 50 * 1024 * 1024) return json(res, 413, { error: "This photo is too large to process. Try a smaller photo." });
        const form = new FormData();
        form.append("image_file", new Blob([photo], { type: "image/png" }), "item.png");
        form.append("format", "png");
        let output;
        try {
          const response = await fetch("https://sdk.photoroom.com/v1/segment", {
            method: "POST", headers: { "x-api-key": key.trim() }, body: form, signal: AbortSignal.timeout(60000),
          });
          if (!response.ok) {
            const message = [401, 403].includes(response.status) ? "Photoroom rejected the API key. Check its credentials and plan." : [402, 429].includes(response.status) ? "Photoroom credits or request limits were reached. Try again later." : "Photoroom could not remove the background. Try again or keep the original.";
            return json(res, 502, { error: message });
          }
          const chunks = [];
          let size = 0;
          for await (const chunk of response.body) {
            size += chunk.length;
            if (size > 18 * 1024 * 1024) return json(res, 413, { error: "The processed photo is too large to save. Try a smaller photo or keep the original." });
            chunks.push(chunk);
          }
          output = Buffer.concat(chunks);
        } catch (error) {
          return json(res, 502, { error: error.name === "TimeoutError" || error.name === "AbortError" ? "Background removal timed out. Retry or keep the original." : "Could not reach Photoroom. Retry or keep the original." });
        }
        try {
          const image = sharp(output, { limitInputPixels: 25000000 });
          const metadata = await image.metadata();
          if (metadata.format !== "png" || !metadata.hasAlpha) throw new Error("Invalid result");
          await image.stats(); // Decode the full image to reject truncated output.
        } catch { return json(res, 502, { error: "Photoroom returned an invalid image. Retry or keep the original." }); }
        return json(res, 200, { imageDataUrl: `data:image/png;base64,${output.toString("base64")}` });
      }
      if (url.pathname === "/api/import/wardrobe" && req.method === "GET") return json(res, 200, await loadImported());
      if (url.pathname === "/api/import/wardrobe" && req.method === "POST") {
        const input = await body(req);
        const metadata = input.metadata || {};
        if (typeof metadata.name !== "string" || !metadata.name.trim() || metadata.name.length > 120 || !PARTS.has(metadata.part) || !HEX_COLOR.test(metadata.color) || (metadata.secondaryColor && !HEX_COLOR.test(metadata.secondaryColor))) {
          return json(res, 400, { error: "Enter a name, category, and valid colors." });
        }
        const match = typeof input.imageDataUrl === "string" && input.imageDataUrl.match(/^data:image\/(?:png|jpeg|webp);base64,(.+)$/s);
        if (!match) return json(res, 400, { error: "Choose a PNG, JPEG, or WebP photo." });
        let photo;
        try { photo = await sharp(Buffer.from(match[1], "base64"), { limitInputPixels: 40000000 }).rotate().png().toBuffer(); }
        catch { return json(res, 400, { error: "This photo could not be read. Choose a valid PNG, JPEG, or WebP image under 40 megapixels." }); }
        const id = `import-${randomUUID()}`;
        const filename = `${id}-garment.png`;
        const record = {
          id, name: metadata.name.trim(), part: metadata.part,
          color: metadata.color.toLowerCase(), secondaryColor: metadata.secondaryColor?.toLowerCase() || null,
          palette: [metadata.color, metadata.secondaryColor].filter(Boolean),
          tags: Array.isArray(metadata.tags) ? metadata.tags.filter(tag => typeof tag === "string").map(tag => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 12) : [],
          image: `${LIBRARY_ASSET_ROOT}/${filename}`, thumbnail: `${LIBRARY_ASSET_ROOT}/${filename}`, modeledImage: null,
        };
        await mutate(async () => {
          const records = await loadImported();
          await writeFile(path.join(libraryAssetDir, filename), photo);
          try { await saveImported([...records, record]); }
          catch (error) { await rm(path.join(libraryAssetDir, filename), { force: true }); throw error; }
        });
        return json(res, 201, record);
      }
      const deletion = url.pathname.match(/^\/api\/import\/wardrobe\/(import-[a-f0-9-]{36})$/i);
      if (deletion && req.method === "PATCH") {
        const { metadata = {} } = await body(req);
        if (!metadata || typeof metadata.name !== "string" || !metadata.name.trim() || metadata.name.length > 120 || !PARTS.has(metadata.part) || !HEX_COLOR.test(metadata.color) || (metadata.secondaryColor && !HEX_COLOR.test(metadata.secondaryColor)) || !Array.isArray(metadata.tags)) {
          return json(res, 400, { error: "Enter a name, category, valid colors, and a list of details." });
        }
        const saved = await mutate(async () => {
          const records = await loadImported();
          const existing = records.find(record => record.id === deletion[1]);
          if (!existing) return null;
          const record = { ...existing, name: metadata.name.trim(), part: metadata.part,
            color: metadata.color.toLowerCase(), secondaryColor: metadata.secondaryColor?.toLowerCase() || null,
            palette: [metadata.color, metadata.secondaryColor].filter(Boolean).map(color => color.toLowerCase()),
            tags: metadata.tags.filter(tag => typeof tag === "string").map(tag => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 12),
          };
          await saveImported(records.map(item => item.id === record.id ? record : item));
          return record;
        });
        return json(res, saved ? 200 : 404, saved || { error: "Item not found" });
      }
      if (deletion && req.method === "DELETE") {
        const id = deletion[1];
        const deleted = await mutate(async () => {
          const records = await loadImported();
          if (!records.some(record => record.id === id)) return false;
          await saveImported(records.filter(record => record.id !== id));
          await Promise.all(["garment", "modeled"].map(kind => rm(path.join(libraryAssetDir, `${id}-${kind}.png`), { force: true })));
          return true;
        });
        return json(res, deleted ? 200 : 404, deleted ? { deleted: true, id } : { error: "Item not found" });
      }
      const asset = url.pathname.match(/^\/api\/import\/library\/([\w-]+\.png)$/i);
      if (asset && req.method === "GET") {
        const photo = await readFile(path.join(libraryAssetDir, asset[1]));
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.end(photo);
      }
      return json(res, 404, { error: "Not found" });
    } catch (error) {
      const status = error.status || (error.code === "ENOENT" ? 404 : 500);
      return json(res, status, { error: status === 500 ? "Could not save your changes. Please try again." : error.message });
    }
  }
  return {
    name: "wardrobe-import-api", apply: "serve",
    async configResolved(config) {
      const dataDir = path.resolve(config.root, options.env?.WARDROBE_DATA_DIR || process.env.WARDROBE_DATA_DIR || "data");
      importedFile = path.join(dataDir, "library.json");
      libraryAssetDir = path.join(dataDir, "imported");
      await mkdir(libraryAssetDir, { recursive: true });
    },
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}
