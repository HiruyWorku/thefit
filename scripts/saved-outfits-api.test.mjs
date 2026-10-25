import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import path from 'node:path';
import sharp from 'sharp';
import { savedOutfitsApi } from './saved-outfits-api.mjs';
import { localOutfitDate, saveFitOfDay, savedPreviewMatches } from '../src/saved-fits.mjs';
import { cachedOutfitPreview, rememberOutfitPreview, requestOutfitPreview } from '../src/outfit-preview.mjs';

async function setup(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'wardrobe-saved-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'imported'));
  const photo = await sharp({ create: { width: 8, height: 10, channels: 4, background: '#aabbcc' } }).png().toBuffer();
  const rows = [
    { id: 'top', name: 'T-shirt', part: 'upperbody', garmentType: 't-shirt', image: '/api/import/library/top.png', color: '#aabbcc' },
    { id: 'pants', name: 'Jeans', part: 'lowerbody', garmentType: 'jeans', image: '/api/import/library/pants.png', color: '#123456' },
    { id: 'shoes', name: 'Sneakers', part: 'shoes', garmentType: 'sneakers', image: '/api/import/library/shoes.png', color: '#ffffff' },
    { id: 'other-top', name: 'Polo', part: 'upperbody', garmentType: 'polo', image: '/api/import/library/top.png', color: '#aabbcc' },
  ];
  for (const name of ['top', 'pants', 'shoes']) await writeFile(path.join(dir, 'imported', `${name}.png`), photo);
  await writeFile(path.join(dir, 'library.json'), JSON.stringify(rows));
  const plugin = savedOutfitsApi({ env: { WARDROBE_DATA_DIR: dir } });
  plugin.configResolved({ root: process.cwd() });
  let handler; plugin.configureServer({ middlewares: { use(fn) { handler = fn; } } });
  const call = async (url, payload, method = 'POST') => {
    const req = Readable.from(payload === undefined ? [] : [Buffer.from(JSON.stringify(payload))]);
    Object.assign(req, { url, method });
    let result;
    const res = { statusCode: 200, setHeader() {}, end(value) { result = { status: this.statusCode, value }; } };
    await handler(req, res, () => { throw new Error('Unexpected route'); });
    return result;
  };
  return { dir, photo, rows, call };
}

test('saving one optional piece with a photo preview is durable and calls no paid providers', async t => {
  const app = await setup(t);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Saving must not call any provider'); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const payload = { date: '2026-10-25', itemIds: ['top'], previewDataUrl: `data:image/png;base64,${app.photo.toString('base64')}` };
  const result = await app.call('/api/outfits/saved', payload);
  assert.equal(result.status, 201);
  const fit = JSON.parse(result.value);
  assert.equal(fit.items.length, 1);
  assert.equal(fit.date, payload.date);
  assert.ok(fit.previewImage);
  assert.deepEqual((await app.call(fit.items[0].image, undefined, 'GET')).value, app.photo);
  assert.deepEqual((await app.call(fit.previewImage, undefined, 'GET')).value, app.photo);
  await writeFile(path.join(app.dir, 'library.json'), '[]');
  await rm(path.join(app.dir, 'imported', 'top.png'));
  const saved = JSON.parse((await app.call('/api/outfits/saved', undefined, 'GET')).value);
  assert.equal(saved[0].items[0].name, 'T-shirt');
  assert.deepEqual((await app.call(saved[0].items[0].image, undefined, 'GET')).value, app.photo);
  const index = JSON.parse(await readFile(path.join(app.dir, 'saved-outfits.json'), 'utf8'));
  assert.equal(index[0].id, fit.id);
});

test('repeat saves avoid duplicates and can attach a later preview to the same fit', async t => {
  const app = await setup(t);
  const payload = { date: '2026-10-25', itemIds: ['top', 'pants', 'shoes'] };
  const first = JSON.parse((await app.call('/api/outfits/saved', payload)).value);
  assert.equal(first.previewImage, null);
  const repeat = await app.call('/api/outfits/saved', { ...payload, previewDataUrl: `data:image/png;base64,${app.photo.toString('base64')}` });
  assert.equal(repeat.status, 200);
  assert.equal(JSON.parse(repeat.value).id, first.id);
  assert.ok(JSON.parse(repeat.value).previewImage);
  assert.equal(JSON.parse((await app.call('/api/outfits/saved', undefined, 'GET')).value).length, 1);
});

test('concurrent dated saves preserve both fits and keep the dates supplied by the user', async t => {
  const app = await setup(t);
  const results = await Promise.all([
    app.call('/api/outfits/saved', { date: '2026-10-24', itemIds: ['top'] }),
    app.call('/api/outfits/saved', { date: '2026-10-25', itemIds: ['shoes'] }),
  ]);
  assert.ok(results.every(result => result.status === 201));
  const saved = JSON.parse((await app.call('/api/outfits/saved', undefined, 'GET')).value);
  assert.deepEqual(saved.map(fit => fit.date).sort(), ['2026-10-24', '2026-10-25']);
});

test('invalid dates, missing items, duplicate roles, unsafe photo paths and invalid previews are rejected', async t => {
  const app = await setup(t);
  for (const payload of [
    { date: '2026-02-30', itemIds: ['top'] }, { date: '2026-10-25', itemIds: [] },
    { date: '2026-10-25', itemIds: ['top', 'top'] }, { date: '2026-10-25', itemIds: ['top', 'other-top'] },
    { date: '2026-10-25', itemIds: ['top'], previewDataUrl: 'data:image/png;base64,bm90LWEgcG5n' },
  ]) assert.equal((await app.call('/api/outfits/saved', payload)).status, 400);
  assert.equal((await app.call('/api/outfits/saved', { date: '2026-10-25', itemIds: ['deleted'] })).status, 404);
  await writeFile(path.join(app.dir, 'library.json'), JSON.stringify([{ ...app.rows[0], image: '/api/import/library/../../private.png' }]));
  assert.equal((await app.call('/api/outfits/saved', { date: '2026-10-25', itemIds: ['top'] })).status, 400);
  assert.deepEqual(JSON.parse((await app.call('/api/outfits/saved', undefined, 'GET')).value), []);
});

test('save uses the local calendar date and sends only selected IDs and an existing preview', async () => {
  assert.equal(localOutfitDate(new Date(2026, 9, 25, 23, 59)), '2026-10-25');
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++; assert.equal(url, '/api/outfits/saved');
    assert.deepEqual(JSON.parse(options.body), { itemIds: ['my-shoes'], date: '2026-10-25', previewDataUrl: null });
    return { ok: true, json: async () => ({ id: 'saved-fit', date: '2026-10-25' }) };
  };
  await assert.rejects(saveFitOfDay({ chosen: [] }, { fetcher }), /at least one/);
  assert.equal(calls, 0);
  await saveFitOfDay({ chosen: [{ item: { id: 'my-shoes' } }] }, { date: '2026-10-25', fetcher });
  assert.equal(calls, 1);
});

test('unchanged restored fits reuse their saved preview without regenerating, while edits invalidate it', async () => {
  const image = '/api/outfits/saved/assets/00000000-0000-4000-8000-000000000001-preview.png';
  const item = { id: 'restored-shirt', name: 'Shirt', part: 'upperbody', garmentType: 'shirt', image: '/api/import/library/shirt.png', tags: [] };
  const outfit = { chosen: [{ item }] };
  const fit = { previewImage: image, items: [{ ...item, sourceImage: item.image, image: '/api/outfits/saved/assets/00000000-0000-4000-8000-000000000001-0.png' }] };
  assert.equal(savedPreviewMatches(fit, outfit), true);
  assert.equal(savedPreviewMatches(fit, { chosen: [{ item: { ...item, name: 'Edited shirt' } }] }), false);
  assert.equal(savedPreviewMatches(fit, { chosen: [] }), false);
  rememberOutfitPreview(outfit, image);
  assert.equal(cachedOutfitPreview(outfit), image);
  assert.equal(await requestOutfitPreview(outfit, async () => { throw new Error('Must reuse saved preview'); }), image);
});

test('saving a restored preview sends its private path without downloading or reuploading the photo', async () => {
  const image = '/api/outfits/saved/assets/00000000-0000-4000-8000-000000000002-preview.png';
  const bytes = Buffer.from('mock-local-photo');
  const urls = [];
  const fetcher = async (url, options) => {
    urls.push(url);
    if (url === image) return { ok: true, arrayBuffer: async () => bytes };
    assert.equal(JSON.parse(options.body).previewDataUrl, null);
    assert.equal(JSON.parse(options.body).previewImage, image);
    return { ok: true, json: async () => ({ id: 'fit', date: '2026-10-25' }) };
  };
  await saveFitOfDay({ chosen: [{ item: { id: 'shirt' } }] }, { date: '2026-10-25', previewDataUrl: image, fetcher });
  assert.deepEqual(urls, ['/api/outfits/saved']);
});
