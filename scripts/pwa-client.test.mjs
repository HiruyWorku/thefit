import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPwa, watchConnection } from '../src/pwa-client.mjs';

function fixture() {
  const browser = new EventTarget();
  browser.document = { readyState: 'complete' };
  browser.navigator = { onLine: true };
  const registration = new EventTarget();
  const installing = new EventTarget();
  installing.state = 'installing';
  registration.installing = installing;
  registration.waiting = null;
  let checks = 0;
  registration.update = async () => { checks++; };
  const notified = [];
  const cleanup = registerPwa({ browser, client: { register: async (url, options) => {
    assert.equal(url, '/sw.js');
    assert.equal(options.updateViaCache, 'none');
    return registration;
  } }, onUpdate: worker => notified.push(worker) });
  return { browser, registration, installing, notified, cleanup, get checks() { return checks; } };
}

test('first install does not interrupt the app; a waiting update is offered without activating it', async () => {
  const app = fixture();
  await Promise.resolve();
  app.installing.state = 'installed';
  app.installing.dispatchEvent(new Event('statechange'));
  assert.equal(app.notified.length, 0);
  const worker = { postMessage() { assert.fail('Must wait for user action'); } };
  app.registration.waiting = worker;
  app.installing.dispatchEvent(new Event('statechange'));
  assert.deepEqual(app.notified, [worker]);
  app.cleanup();
});

test('reconnection checks for updates, offline focus does not, and unmount removes listeners', async () => {
  const app = fixture();
  await Promise.resolve();
  app.browser.navigator.onLine = false;
  app.browser.dispatchEvent(new Event('focus'));
  assert.equal(app.checks, 0);
  app.browser.navigator.onLine = true;
  app.browser.dispatchEvent(new Event('online'));
  assert.equal(app.checks, 1);
  app.cleanup();
  app.browser.dispatchEvent(new Event('focus'));
  app.registration.waiting = {};
  app.installing.state = 'installed';
  app.installing.dispatchEvent(new Event('statechange'));
  assert.equal(app.checks, 1);
  assert.equal(app.notified.length, 0);
});

test('registration failure leaves the online app usable', async () => {
  const browser = new EventTarget();
  browser.document = { readyState: 'complete' };
  browser.navigator = { onLine: true };
  const cleanup = registerPwa({ browser, client: { register: async () => { throw new Error('Storage unavailable'); } }, onUpdate() { assert.fail('No update'); } });
  await new Promise(resolve => setImmediate(resolve));
  cleanup();
});

test('connection detection handles a network failure even when the browser reports online, then recovers', async () => {
  const browser = new EventTarget();
  browser.navigator = { onLine: true };
  let reachable = false;
  let requests = 0;
  const states = [];
  const connection = watchConnection({ browser, onChange: value => states.push(value), fetcher: async url => {
    requests++;
    assert.equal(url, '/api/health');
    if (!reachable) throw new TypeError('Network failed');
    return new Response('ok');
  } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(states, [true]);
  reachable = true;
  await connection.check();
  assert.deepEqual(states, [true, false]);
  browser.navigator.onLine = false;
  browser.dispatchEvent(new Event('offline'));
  assert.deepEqual(states, [true, false, true]);
  assert.equal(requests, 2);
  connection.dispose();
  browser.dispatchEvent(new Event('focus'));
  assert.equal(requests, 2);
});
