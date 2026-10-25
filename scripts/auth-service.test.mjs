import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService } from '../src/auth-service.mjs';
import { supabaseConfiguration } from '../src/supabase-config.mjs';

test('missing or malformed Supabase settings return a recoverable configuration error', async () => {
  assert.ok(supabaseConfiguration({}).error);
  assert.ok(supabaseConfiguration({ VITE_SUPABASE_URL: 'bad-url', VITE_SUPABASE_ANON_KEY: 'test-public-key' }).error);
  assert.equal(supabaseConfiguration({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-public-key' }).error, '');
  const auth = createAuthService(null);
  assert.ok((await auth.signInUser('me@example.test', 'password')).error);
  assert.ok((await auth.signUpUser('me@example.test', 'password', 'my-name')).error);
  assert.equal(await auth.getCurrentUser(), null);
  assert.equal((await auth.signOutUser()).error, null);
});

test('signup preserves username through confirmation and never inserts an unauthenticated profile', async () => {
  let calls = 0;
  const auth = createAuthService({ auth: { signUp: async options => {
    calls++;
    assert.deepEqual(options, { email: 'me@example.test', password: 'example-password', options: { data: { username: 'my-name' }, emailRedirectTo: 'http://localhost:5173/app' } });
    return { data: { user: { id: 'new-user' }, session: null }, error: null };
  } }, from() { throw new Error('No database insert is allowed before a session exists'); } });
  const result = await auth.signUpUser(' me@example.test ', 'example-password', ' My-Name ', 'http://localhost:5173/app');
  assert.equal(result.data.session, null);
  assert.equal(result.error, null);
  assert.equal(calls, 1);
  assert.ok((await auth.signUpUser('me@example.test', 'example-password', 'a')).error);
  assert.equal(calls, 1);
});

test('profile creation waits for an authenticated user, is private by default and deduplicates in-flight loads', async () => {
  let reads = 0, writes = 0;
  const client = { from(table) {
    assert.equal(table, 'profiles');
    let writing = false;
    const query = {
      select() { return query; }, eq(_field, id) { assert.equal(id, 'user-1234'); return query; },
      upsert(value, options) { writing = true; writes++; assert.deepEqual(value, { id: 'user-1234', username: 'my-name', is_public: false }); assert.equal(options.onConflict, 'id'); return query; },
      async maybeSingle() { if (!writing) { reads++; return { data: null, error: null }; } return { data: { id: 'user-1234', username: 'my-name', is_public: false }, error: null }; },
    };
    return query;
  } };
  const auth = createAuthService(client);
  assert.equal((await auth.ensureProfile(null)).profile, null);
  const user = { id: 'user-1234', user_metadata: { username: 'My-Name' } };
  const results = await Promise.all([auth.ensureProfile(user), auth.ensureProfile(user)]);
  assert.equal(reads, 1); assert.equal(writes, 1);
  assert.equal(results[0].profile.id, user.id);
});

test('profile database failures do not turn a valid account session into a login failure', async () => {
  const user = { id: 'existing-user' };
  const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: null, error: { message: 'Profile access unavailable' } }) };
  const auth = createAuthService({ auth: { getUser: async () => ({ data: { user }, error: null }), signInWithPassword: async () => ({ data: { user, session: { user } }, error: null }) }, from: () => query });
  assert.equal((await auth.signInUser('me@example.test', 'password')).error, null);
  const current = await auth.getCurrentUser();
  assert.equal(current.id, user.id);
  assert.equal(current.profile, null);
  assert.ok(current.profileError);
});

test('existing profiles are retained and network failures are recoverable', async () => {
  const existing = { id: 'user', username: 'already-chosen', is_public: true };
  const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: existing, error: null }) };
  const auth = createAuthService({ auth: { signInWithPassword: async () => { throw new Error('network'); }, signOut: async () => { throw new Error('network'); } }, from: () => query });
  assert.equal((await auth.ensureProfile({ id: 'user', user_metadata: { username: 'different' } })).profile, existing);
  assert.match((await auth.signInUser('me@example.test', 'password')).error.message, /try again/i);
  assert.ok((await auth.signOutUser()).error);
});
