import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { accountApi } from './account-api.mjs';
import { cloudWardrobeApi } from './cloud-wardrobe-api.mjs';
import { cloudWardrobeStore, BUCKET } from './cloud-wardrobe-store.mjs';
import { wardrobeTryOnApi } from './try-on-api.mjs';
import { clearOutfitPreviews, cachedOutfitPreview, requestOutfitPreview } from '../src/outfit-preview.mjs';

function handler(plugin) { let fn; plugin.configureServer({ middlewares: { use(value) { fn = value; } } }); return fn; }
async function call(fn, url, { method = 'GET', payload, headers = {}, account } = {}) {
  const req = Object.assign(Readable.from(payload ? [Buffer.from(JSON.stringify(payload))] : []), { url, method, headers: { host: 'fit.test', ...headers }, account });
  const response = { status: 200, headers: {}, next: false };
  const res = { statusCode: 200, setHeader(k, v) { response.headers[k.toLowerCase()] = v; }, end(value) { response.status = this.statusCode; response.body = value; } };
  await fn(req, res, () => { response.next = true; response.account = req.account; });
  if (response.headers['content-type']?.includes('json')) response.json = JSON.parse(response.body);
  return response;
}
const env = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public-test' };
const verifiedClient = { auth: { async getClaims(token) { return token === 'valid' ? { data: { claims: { sub: 'alice', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 600 } } } : { error: { message: 'Invalid' } }; } } };

test('every private data, photo and paid endpoint rejects guests and invalid sessions', async () => {
  const fn = handler(accountApi({ env, clientFactory: () => verifiedClient }));
  for (const url of ['/api/import/wardrobe', '/api/import/library/item.png', '/api/outfits/saved', '/api/outfits/saved/assets/00000000-0000-0000-0000-000000000000-preview.png', '/api/account/reference/image', '/api/import/remove-background', '/api/outfits/try-on', '/api/decart/token']) {
    assert.equal((await call(fn, url)).status, 401, url);
    assert.equal((await call(fn, url, { headers: { authorization: 'Bearer forged' } })).status, 401, url);
  }
  assert.equal((await call(fn, '/')).next, true);
  assert.equal((await call(handler(accountApi()), '/api/import/wardrobe')).status, 503);
});

test('verified sessions use private HttpOnly cookies, reject cross-site writes, and clear on logout', async () => {
  const fn = handler(accountApi({ env, clientFactory: () => verifiedClient }));
  const login = await call(fn, '/api/auth/session', { method: 'POST', headers: { authorization: 'Bearer valid', origin: 'https://fit.test' } });
  assert.equal(login.status, 200);
  assert.match(login.headers['set-cookie'], /HttpOnly; SameSite=Strict/);
  const cookie = login.headers['set-cookie'].split(';')[0];
  const read = await call(fn, '/api/import/wardrobe', { headers: { cookie } });
  assert.equal(read.account.userId, 'alice');
  assert.match(read.headers['cache-control'], /no-store/);
  assert.equal((await call(fn, '/api/import/wardrobe', { method: 'POST', headers: { cookie, origin: 'https://other.test' } })).status, 403);
  assert.equal((await call(fn, '/api/import/wardrobe', { method: 'POST', headers: { cookie, origin: 'null' } })).status, 403);
  const logout = await call(fn, '/api/auth/session', { method: 'DELETE' });
  assert.match(logout.headers['set-cookie'], /Max-Age=0/);
});

test('expired or non-user claims never authorize access', async () => {
  for (const claims of [{ sub: 'alice', role: 'authenticated', exp: 1 }, { sub: 'alice', role: 'anon', exp: 9999999999 }, { role: 'authenticated', exp: 9999999999 }]) {
    const fn = handler(accountApi({ env, clientFactory: () => ({ auth: { getClaims: async () => ({ data: { claims } }) } }) }));
    assert.equal((await call(fn, '/api/import/wardrobe', { headers: { authorization: 'Bearer token' } })).status, 401);
  }
});

function stores() {
  const accounts = new Map();
  return ({ userId }) => {
    if (!accounts.has(userId)) {
      const items = new Map(), fits = new Map(), images = new Map(); let reference;
      accounts.set(userId, {
        listItems: async () => [...items.values()], item: async id => items.get(id), putItem: async item => { items.set(item.id, item); }, deleteItem: async id => { items.delete(id); },
        listFits: async () => [...fits.values()], fitByFingerprint: async value => [...fits.values()].find(fit => fit.fingerprint === value), putFit: async fit => { fits.set(fit.id, fit); },
        readImage: async name => { if (!images.has(name)) throw Object.assign(new Error('Missing'), { status: 404 }); return images.get(name); },
        imageUrl: async name => { if (!images.has(name)) throw Object.assign(new Error('Missing'), { status: 404 }); return `https://storage.example.test/${userId}/${name}?token=short-lived`; },
        writeImage: async (name, bytes) => { images.set(name, bytes); }, removeImages: async names => { names.forEach(name => images.delete(name)); },
        reference: async () => reference, setReference: async name => { reference = name; },
      });
    }
    return accounts.get(userId);
  };
}
const source = await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 30, g: 40, b: 50, alpha: 0.5 } } }).png().toBuffer();
const photo = `data:image/png;base64,${source.toString('base64')}`;

test('uploads, edits, snapshots and reference photos are scoped to the verified account', async () => {
  const fn = handler(cloudWardrobeApi({ storeFactory: stores() }));
  const alice = { userId: 'alice' }, bob = { userId: 'bob' };
  const metadata = { name: 'My top', part: 'upperbody', color: '#123456', tags: ['cotton'] };
  assert.equal((await call(fn, '/api/import/wardrobe')).status, 401);
  const created = await call(fn, '/api/import/wardrobe', { method: 'POST', account: alice, payload: { metadata, imageDataUrl: photo } });
  assert.equal(created.status, 201);
  const item = created.json;
  const photoRedirect = await call(fn, item.image, { account: alice });
  assert.equal(photoRedirect.status, 302);
  assert.match(photoRedirect.headers.location, /alice\/items\//);
  assert.match(photoRedirect.headers['cache-control'], /no-store/);
  assert.equal((await call(fn, item.image, { account: bob })).status, 404);
  assert.deepEqual((await call(fn, '/api/import/wardrobe', { account: bob })).json, []);
  assert.equal((await call(fn, `/api/import/wardrobe/${item.id}`, { method: 'PATCH', account: bob, payload: { metadata } })).status, 404);
  assert.equal((await call(fn, `/api/import/wardrobe/${item.id}`, { method: 'DELETE', account: bob })).status, 404);
  assert.equal((await call(fn, '/api/outfits/saved', { method: 'POST', account: bob, payload: { itemIds: [item.id], date: '2026-10-25' } })).status, 404);
  const saved = await call(fn, '/api/outfits/saved', { method: 'POST', account: alice, payload: { itemIds: [item.id], date: '2026-10-25', previewDataUrl: photo } });
  assert.equal(saved.status, 201);
  const repeat = await call(fn, '/api/outfits/saved', { method: 'POST', account: alice, payload: { itemIds: [item.id], date: '2026-10-25' } });
  assert.equal(repeat.json.id, saved.json.id);
  assert.equal((await call(fn, saved.json.previewImage, { account: bob })).status, 404);
  assert.deepEqual((await call(fn, '/api/outfits/saved', { account: bob })).json, []);
  await call(fn, `/api/import/wardrobe/${item.id}`, { method: 'DELETE', account: alice });
  assert.equal((await call(fn, saved.json.items[0].image, { account: alice })).status, 302, 'snapshot survives original deletion');
  assert.equal((await call(fn, '/api/account/reference', { method: 'POST', account: alice, payload: { imageDataUrl: photo } })).status, 200);
  assert.equal((await call(fn, '/api/account/reference/image', { account: alice })).status, 302);
  assert.equal((await call(fn, '/api/account/reference/image', { account: bob })).status, 404);
});

test('account storage always filters by owner and prefixes every private bucket object', async () => {
  const filters = [], paths = [];
  const query = { select() { return query; }, eq(k, v) { filters.push([k, v]); return query; }, order() { return query; }, delete() { return query; }, upsert(value) { assert.equal(value.user_id, 'alice'); return query; }, maybeSingle: async () => ({ data: null }), then(resolve) { return Promise.resolve({ data: [] }).then(resolve); } };
  const client = { from() { return query; }, storage: { from(bucket) { assert.equal(bucket, BUCKET); return { download: async name => { paths.push(name); return { data: new Blob([source]) }; }, upload: async name => { paths.push(name); return {}; }, remove: async names => { paths.push(...names); return {}; } }; } } };
  const store = cloudWardrobeStore({ client, userId: 'alice' });
  await store.listItems(); await store.item('id'); await store.deleteItem('id'); await store.listFits(); await store.fitByFingerprint('hash'); await store.reference();
  assert.equal(filters.filter(([k, v]) => k === 'user_id' && v === 'alice').length, 6);
  await store.putItem({ id: 'id' }); await store.setReference('reference/00000000-0000-0000-0000-000000000000.png');
  await store.writeImage('items/garment.png', source); await store.readImage('items/garment.png'); await store.removeImages(['items/garment.png']);
  assert.ok(paths.every(path => path === 'alice/items/garment.png'));
  await assert.rejects(store.readImage('../bob/items/photo.png'));
});

test('old in-flight previews cannot refill another account’s preview cache', async () => {
  clearOutfitPreviews();
  const outfit = { chosen: [{ item: { id: 'shirt' } }] };
  let finish;
  const pending = requestOutfitPreview(outfit, () => new Promise(resolve => { finish = resolve; }));
  clearOutfitPreviews();
  finish(Response.json({ imageDataUrl: photo }));
  await pending;
  assert.equal(cachedOutfitPreview(outfit), null);
});

test('cloud photo try-on cannot fall back to the shared local identity reference', async () => {
  const fn = handler(wardrobeTryOnApi({ accountStorage: true }));
  assert.equal((await call(fn, '/api/outfits/try-on', { method: 'POST', payload: { itemIds: ['shirt'] } })).status, 401);
});

test('direct upload finalization validates owned paths and preserves identity on repeated requests', async () => {
  const factory = stores(); const alice = { userId: 'alice' }, bob = { userId: 'bob' };
  const fn = handler(cloudWardrobeApi({ storeFactory: factory }));
  const imagePath = 'items/import-00000000-0000-4000-8000-000000000003-garment.png';
  await factory(alice).writeImage(imagePath, source);
  const metadata = { name: 'Uploaded top', part: 'upperbody', color: '#123456', tags: [] };
  const payload = { imagePath, metadata };
  assert.equal((await call(fn, '/api/import/wardrobe', { method: 'POST', account: bob, payload })).status, 404);
  const saved = await call(fn, '/api/import/wardrobe', { method: 'POST', account: alice, payload });
  assert.equal(saved.status, 201);
  assert.equal(saved.json.id, 'import-00000000-0000-4000-8000-000000000003');
  assert.equal((await call(fn, '/api/import/wardrobe', { method: 'POST', account: alice, payload })).status, 200);
  assert.equal((await factory(alice).listItems()).length, 1);
  const ref = 'reference/00000000-0000-4000-8000-000000000004.png';
  await factory(alice).writeImage(ref, source);
  assert.equal((await call(fn, '/api/account/reference', { method: 'POST', account: alice, payload: { imagePath: ref } })).status, 200);
  assert.equal(await factory(alice).reference(), ref);
  assert.equal((await call(fn, '/api/import/wardrobe', { method: 'POST', account: alice, payload: { ...payload, imagePath: '../bob/file.png' } })).status, 400);
});

test('cloud preview returns a small private URL and is reused across server restarts without another paid call', async t => {
  const factory = stores(); const account = { userId: 'alice' }; const store = factory(account);
  await store.putItem({ id: 'top', name: 'Top', part: 'upperbody', image: '/api/import/library/top.png' });
  await store.writeImage('items/top.png', source);
  await store.setReference('reference/00000000-0000-4000-8000-000000000005.png');
  await store.writeImage(await store.reference(), source);
  let calls = 0; const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { calls++; return Response.json({ data: [{ b64_json: source.toString('base64') }] }); };
  const create = () => handler(wardrobeTryOnApi({ env: { OPENAI_API_KEY: 'test-only' }, accountStorage: true, storeFactory: factory }));
  const first = await call(create(), '/api/outfits/try-on', { method: 'POST', account, payload: { itemIds: ['top'] } });
  assert.equal(first.status, 200);
  assert.match(first.json.imageUrl, /^\/api\/outfits\/previews\/[a-f0-9]{64}\.png$/);
  assert.ok(first.body.length < 200);
  const afterRestart = await call(create(), '/api/outfits/try-on', { method: 'POST', account, payload: { itemIds: ['top'] } });
  assert.deepEqual(afterRestart.json, first.json);
  assert.equal(calls, 1);
});
