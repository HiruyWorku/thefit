import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { wardrobeImportApi } from './import-job-api.mjs';

const toUrl = bytes => `data:image/png;base64,${bytes.toString('base64')}`;
test('optional background removal and persistence', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wardrobe-bg-test-'));
  const originalFetch = globalThis.fetch;
  t.after(async () => { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); });
  const env = { WARDROBE_DATA_DIR: dir, PHOTOROOM_API_KEY: 'test-server-only-key' };
  const plugin = wardrobeImportApi({ env });
  await plugin.configResolved({ root: process.cwd() });
  let handler;
  plugin.configureServer({ middlewares: { use(fn) { handler = fn; } } });
  const call = async (url, payload, method = 'POST') => {
    const req = Readable.from(payload ? [Buffer.from(JSON.stringify(payload))] : []);
    Object.assign(req, { url, method });
    let result;
    const res = { statusCode: 200, setHeader() {}, end(value) { result = { status: this.statusCode, value }; } };
    await handler(req, res, () => { throw new Error('Unexpected fallthrough'); });
    return result;
  };
  const source = await sharp({ create: { width: 10, height: 8, channels: 4, background: '#abcdef' } }).png().toBuffer();
  const transparent = await sharp({ create: { width: 10, height: 8, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } }).png().toBuffer();
  const input = { imageDataUrl: toUrl(source) };
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://sdk.photoroom.com/v1/segment');
    assert.equal(options.headers['x-api-key'], env.PHOTOROOM_API_KEY);
    assert.equal(options.body.get('format'), 'png');
    const photo = Buffer.from(await options.body.get('image_file').arrayBuffer());
    const { width, height } = await sharp(photo).metadata();
    assert.ok(width <= 6000 && height <= 6000 && width * height <= 25000000);
    return new Response(transparent);
  };
  await t.test('preview does not save; saving retains transparency and manual details', async () => {
    const preview = await call('/api/import/remove-background', input);
    assert.equal(preview.status, 200);
    assert.ok(!preview.value.includes(env.PHOTOROOM_API_KEY));
    assert.deepEqual(JSON.parse((await call('/api/import/wardrobe', null, 'GET')).value), []);
    const result = await call('/api/import/wardrobe', { ...JSON.parse(preview.value), metadata: { name: 'My top', part: 'upperbody', color: '#abcdef', tags: ['cotton'] } });
    assert.equal(result.status, 201);
    const record = JSON.parse(result.value);
    assert.equal(record.name, 'My top');
    assert.deepEqual(record.tags, ['cotton']);
    const asset = await call(record.image, null, 'GET');
    assert.deepEqual(await sharp(asset.value).raw().toBuffer(), await sharp(transparent).raw().toBuffer());
    const count = calls;
    assert.equal((await call('/api/import/wardrobe', { ...input, metadata: { name: 'Original', part: 'shoes', color: '#abcdef' } })).status, 201);
    assert.equal(calls, count, 'saving an original never invokes Photoroom');
  });
  await t.test('editing persists metadata without changing the photo', async () => {
    const records = JSON.parse((await call('/api/import/wardrobe', null, 'GET')).value);
    const original = records[0];
    const metadata = { name: 'Updated jacket', part: 'wholebody_up', color: '#123456', secondaryColor: '#ffffff', tags: ['warm'] };
    const response = await call(`/api/import/wardrobe/${original.id}`, { metadata }, 'PATCH');
    assert.equal(response.status, 200);
    const updated = JSON.parse(response.value);
    assert.equal(updated.image, original.image);
    assert.equal(updated.thumbnail, original.thumbnail);
    assert.equal(updated.name, metadata.name);
    assert.deepEqual(updated.tags, ['warm']);
    assert.deepEqual(updated.palette, ['#123456', '#ffffff']);
    assert.equal(JSON.parse((await call('/api/import/wardrobe', null, 'GET')).value)[0].part, 'wholebody_up');
    assert.equal((await call(`/api/import/wardrobe/${original.id}`, { metadata: { ...metadata, name: '' } }, 'PATCH')).status, 400);
    assert.equal((await call('/api/import/wardrobe/import-00000000-0000-0000-0000-000000000000', { metadata }, 'PATCH')).status, 404);
  });
  await t.test('large input is resized within provider limits', async () => {
    const large = await sharp({ create: { width: 7000, height: 4000, channels: 3, background: '#abcdef' } }).png().toBuffer();
    assert.equal((await call('/api/import/remove-background', { imageDataUrl: toUrl(large) })).status, 200);
  });
  await t.test('invalid input never calls provider', async () => {
    const count = calls;
    assert.equal((await call('/api/import/remove-background', { imageDataUrl: toUrl(Buffer.from('invalid')) })).status, 400);
    assert.equal(calls, count);
  });
  await t.test('missing configuration does not call provider', async () => {
    const previous = env.PHOTOROOM_API_KEY;
    env.PHOTOROOM_API_KEY = ' ';
    const count = calls;
    assert.equal((await call('/api/import/remove-background', input)).status, 503);
    assert.equal(calls, count);
    env.PHOTOROOM_API_KEY = previous;
  });
  await t.test('provider failures, timeout, invalid and oversized results', async () => {
    for (const status of [401, 403, 402, 429, 500]) {
      let attempts = 0;
      globalThis.fetch = async () => { attempts++; return new Response('secret upstream details', { status }); };
      const result = await call('/api/import/remove-background', input);
      assert.equal(result.status, 502);
      assert.equal(attempts, 1);
      assert.ok(!result.value.includes('secret upstream details'));
    }
    globalThis.fetch = async () => { throw new DOMException('timeout', 'TimeoutError'); };
    assert.match((await call('/api/import/remove-background', input)).value, /timed out/);
    globalThis.fetch = async () => new Response('invalid PNG');
    assert.equal((await call('/api/import/remove-background', input)).status, 502);
    globalThis.fetch = async () => new Response(Buffer.alloc(18 * 1024 * 1024 + 1));
    assert.equal((await call('/api/import/remove-background', input)).status, 413);
    assert.equal(JSON.parse((await call('/api/import/wardrobe', null, 'GET')).value).length, 2);
  });
});
