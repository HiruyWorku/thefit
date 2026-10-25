import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { planLocalMigration, migrateLocalData } from './migrate-local-data.mjs';

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fit-migrate-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'imported')); await mkdir(path.join(dir, 'saved-outfits'));
  const image = Buffer.from('local photo bytes');
  const fitId = '00000000-0000-0000-0000-000000000001';
  const item = { id: 'import-top', name: 'My top', part: 'upperbody', color: '#123456', image: '/api/import/library/top.png', thumbnail: '/api/import/library/top.png', tags: ['cotton'] };
  const fit = { id: fitId, fingerprint: 'original-fingerprint', date: '2026-10-24', items: [{ ...item, image: `/api/outfits/saved/assets/${fitId}-0.png` }], previewImage: `/api/outfits/saved/assets/${fitId}-preview.png` };
  await writeFile(path.join(dir, 'library.json'), JSON.stringify([item]));
  await writeFile(path.join(dir, 'saved-outfits.json'), JSON.stringify([fit]));
  await writeFile(path.join(dir, 'catalog-attributions.json'), JSON.stringify({ items: [{ id: item.id, license: 'CC BY-NC 4.0', publisher: 'Original source' }] }));
  await writeFile(path.join(dir, 'imported', 'top.png'), image);
  for (const name of [`${fitId}-0.png`, `${fitId}-preview.png`]) await writeFile(path.join(dir, 'saved-outfits', name), image);
  const items = new Map(), fits = new Map(), photos = new Map(); let uploads = 0;
  const store = { listItems: async () => [...items.values()], listFits: async () => [...fits.values()],
    putItem: async row => items.set(row.id, row), putFit: async row => fits.set(row.id, row), fitByFingerprint: async value => [...fits.values()].find(fit => fit.fingerprint === value),
    readImage: async name => { if (!photos.has(name)) throw Object.assign(new Error('Missing'), { status: 404 }); return photos.get(name); },
    writeImage: async (name, bytes) => { uploads++; photos.set(name, bytes); },
  };
  return { dir, store, item, fit, image, items, fits, photos, uploads: () => uploads };
}

test('migration preserves exact photos, IDs, dates, metadata, attribution and local source files', async t => {
  const f = await fixture(t); const before = await readFile(path.join(f.dir, 'library.json'));
  const plan = await planLocalMigration(f.dir);
  assert.deepEqual(plan.summary, { items: 1, fits: 1, images: 3, bytes: f.image.length * 3 });
  const result = await migrateLocalData(plan, f.store, { expectedDigest: plan.digest });
  assert.equal(result.verifiedItems, 1); assert.equal(result.verifiedFits, 1); assert.equal(result.uploadedImages, 3);
  assert.equal(f.items.get(f.item.id).attribution.publisher, 'Original source');
  assert.deepEqual(f.fits.get(f.fit.id), f.fit);
  assert.deepEqual(await readFile(path.join(f.dir, 'library.json')), before);
  assert.ok([...f.photos.values()].every(bytes => bytes.equals(f.image)));
});

test('repeated migrations never duplicate photos or overwrite newer account edits', async t => {
  const f = await fixture(t); const plan = await planLocalMigration(f.dir);
  await migrateLocalData(plan, f.store);
  f.items.set(f.item.id, { ...f.items.get(f.item.id), name: 'Newer account edit' });
  const result = await migrateLocalData(plan, f.store);
  assert.equal(result.importedItems, 0); assert.equal(result.importedFits, 0); assert.equal(result.uploadedImages, 0);
  assert.equal(f.uploads(), 3); assert.equal(f.items.get(f.item.id).name, 'Newer account edit');
});

test('interrupted image copies can resume without deleting local data or reuploading copied photos', async t => {
  const f = await fixture(t); const plan = await planLocalMigration(f.dir);
  let failOnce = true;
  await assert.rejects(migrateLocalData(plan, f.store, { onProgress: async () => { if (failOnce) { failOnce = false; throw new Error('interrupted'); } } }), /interrupted/);
  assert.equal(f.items.size, 0);
  const result = await migrateLocalData(plan, f.store);
  assert.equal(result.reusedImages, 1); assert.equal(f.uploads(), 3); assert.equal(f.fits.size, 1);
});

test('preflight rejects missing, unsafe or changed source data before any cloud mutation', async t => {
  const f = await fixture(t); const plan = await planLocalMigration(f.dir);
  await assert.rejects(migrateLocalData(plan, f.store, { expectedDigest: 'different' }), /changed/);
  assert.equal(f.uploads(), 0);
  await writeFile(path.join(f.dir, 'library.json'), JSON.stringify([{ ...f.item, image: '/api/import/library/../../secret.png' }]));
  await assert.rejects(planLocalMigration(f.dir), /unsupported image path/);
  await writeFile(path.join(f.dir, 'library.json'), JSON.stringify([{ ...f.item, image: '/api/import/library/missing.png' }]));
  await assert.rejects(planLocalMigration(f.dir));
  assert.equal(f.uploads(), 0);
});

test('different existing cloud photos are preserved and block migration of the conflicting record', async t => {
  const f = await fixture(t); const plan = await planLocalMigration(f.dir);
  f.photos.set('items/top.png', Buffer.from('different account photo'));
  await assert.rejects(migrateLocalData(plan, f.store), /differs/);
  assert.equal(f.uploads(), 0); assert.equal(f.items.size, 0);
  assert.equal(f.photos.get('items/top.png').toString(), 'different account photo');
});
