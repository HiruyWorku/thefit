import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const bundledCatalog = fileURLToPath(new URL('../sample-wardrobe/', import.meta.url));
const assetName = url => {
  const match = typeof url === 'string' && url.match(/^\/api\/import\/library\/(import-[a-f0-9-]{36}-garment\.png)$/i);
  if (!match) throw new Error('The sample wardrobe contains an invalid garment image path.');
  return match[1];
};
async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
async function saveJson(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

// Run while the app server is stopped so local edits cannot race this import.
export async function seedWardrobe({ dataDir = process.env.WARDROBE_DATA_DIR || 'data', catalogDir = bundledCatalog } = {}) {
  dataDir = path.resolve(dataDir);
  const samples = await readJson(path.join(catalogDir, 'library.json'));
  const credits = await readJson(path.join(catalogDir, 'catalog-attributions.json'));
  const libraryFile = path.join(dataDir, 'library.json');
  const current = await readJson(libraryFile, []);
  if (!Array.isArray(samples) || !Array.isArray(current)) throw new Error('Wardrobe libraries must be arrays.');
  const sampleIds = new Set();
  for (const row of samples) {
    const filename = assetName(row.image);
    if (sampleIds.has(row.id) || filename !== `${row.id}-garment.png` || row.modeledImage || row.thumbnail !== row.image) {
      throw new Error('The sample wardrobe contains duplicate IDs or unexpected assets.');
    }
    sampleIds.add(row.id);
  }
  const existingIds = new Set(current.map(row => row.id));
  const added = samples.filter(row => !existingIds.has(row.id));
  if (!added.length) return { added: 0, total: current.length, library: libraryFile };
  await mkdir(path.join(dataDir, 'imported'), { recursive: true });
  for (const row of added) {
    const filename = assetName(row.image);
    const source = path.join(catalogDir, 'imported', filename);
    const destination = path.join(dataDir, 'imported', filename);
    try { await copyFile(source, destination, constants.COPYFILE_EXCL); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const [original, saved] = await Promise.all([readFile(source), readFile(destination)]);
      if (!original.equals(saved)) throw new Error(`An existing photo conflicts with sample ${row.name}; nothing was overwritten.`);
    }
  }
  const creditsFile = path.join(dataDir, 'catalog-attributions.json');
  const localCredits = await readJson(creditsFile, { ...credits, items: [] });
  if (!Array.isArray(localCredits.items) || !Array.isArray(credits.items)) throw new Error('Invalid wardrobe attribution records.');
  const addedIds = new Set(added.map(row => row.id));
  const creditedIds = new Set(localCredits.items.map(row => row.id));
  const newCredits = credits.items.filter(row => addedIds.has(row.id) && !creditedIds.has(row.id));
  await saveJson(creditsFile, { ...localCredits, items: [...localCredits.items, ...newCredits] });
  await saveJson(libraryFile, [...current, ...added]);
  return { added: added.length, total: current.length + added.length, library: libraryFile };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--data-dir' || !args[1])) {
    throw new Error('Usage: npm run seed:wardrobe -- [--data-dir <directory>]');
  }
  console.log(JSON.stringify(await seedWardrobe(args.length ? { dataDir: args[1] } : {}), null, 2));
}
