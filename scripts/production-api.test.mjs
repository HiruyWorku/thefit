import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createApiHandler } from './api-handler.mjs';
import { accountApi, sendJson } from './account-api.mjs';
import { uploadPrivatePhoto } from '../src/private-upload.mjs';

test('production handler awaits async middleware and preserves the authenticated request and body', async t => {
  const env = { VITE_SUPABASE_URL: 'https://project.example.test', VITE_SUPABASE_ANON_KEY: 'public-key' };
  const client = { auth: { getClaims: async () => ({ data: { claims: { sub: 'owner', role: 'authenticated', exp: Date.now() / 1000 + 300 } } }) } };
  const protectedRoute = { configureServer(server) { server.middlewares.use(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    await Promise.resolve(); sendJson(res, 200, { owner: req.account.userId, payload: JSON.parse(body), path: req.url });
  }); } };
  const handler = await createApiHandler({ plugins: [accountApi({ env, clientFactory: () => client }), protectedRoute] });
  const server = createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/api/import/wardrobe`)).status, 401);
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  const response = await fetch(`${base}/api/import/wardrobe`, { method: 'POST', headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'My shirt' }) });
  assert.deepEqual(await response.json(), { owner: 'owner', payload: { name: 'My shirt' }, path: '/api/import/wardrobe' });
});

test('production handler returns JSON for unknown API routes and unexpected failures', async () => {
  for (const plugins of [[], [{ configureServer(server) { server.middlewares.use(() => { throw new Error('Secret upstream error'); }); } }]]) {
    const handler = await createApiHandler({ plugins });
    const req = Object.assign(Readable.from([]), { url: '/api/missing', method: 'GET' });
    let result;
    const res = { statusCode: 200, setHeader() {}, end(value) { result = { status: this.statusCode, body: JSON.parse(value) }; } };
    await handler(req, res);
    assert.ok([404, 500].includes(result.status));
    assert.doesNotMatch(JSON.stringify(result.body), /Secret upstream/);
  }
});

test('large photos upload directly to the account bucket, while metadata requests only need the object path', async () => {
  const calls = []; const photo = new Blob([new Uint8Array(5 * 1024 * 1024)], { type: 'image/png' });
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: 'owner' } } } }) }, storage: { from(bucket) { assert.equal(bucket, 'wardrobe-private'); return { upload: async (name, bytes, options) => { calls.push(name); assert.equal(bytes, photo); assert.equal(options.upsert, false); return {}; } }; } } };
  const uuid = () => '00000000-0000-4000-8000-000000000001';
  const result = await uploadPrivatePhoto(photo, 'items', { client, uuid, normalize: async value => value });
  assert.equal(result.imagePath, `items/import-${uuid()}-garment.png`);
  assert.deepEqual(calls, [`owner/${result.imagePath}`]);
  assert.ok(JSON.stringify(result).length < 200);
  const prepared = `/api/import/library/import-${uuid()}-garment.png`;
  assert.deepEqual(await uploadPrivatePhoto(prepared, 'items', { client }), result);
  assert.equal(calls.length, 1, 'reusing a prepared image makes no duplicate storage upload');
});

test('photo upload rejects guests, invalid destinations, and oversized output before storage writes', async () => {
  const client = { auth: { getSession: async () => ({ data: { session: null } }) } };
  await assert.rejects(uploadPrivatePhoto(new Blob(), 'items', { client }), /log in/);
  await assert.rejects(uploadPrivatePhoto(new Blob(), 'someone-else', { client }), /valid photo type/);
  client.auth.getSession = async () => ({ data: { session: { user: { id: 'owner' } } } });
  await assert.rejects(uploadPrivatePhoto(new Blob(), 'items', { client, normalize: async () => ({ size: 26 * 1024 * 1024 }) }), /smaller photo/);
});
