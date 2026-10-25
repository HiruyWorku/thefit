// Registration does not access authentication, wardrobe data, or paid APIs.
export function watchConnection({ onChange, browser = window, fetcher = fetch }) {
  let disposed = false;
  let controller;
  const check = async () => {
    if (disposed) return;
    if (!browser.navigator.onLine) { controller?.abort(); onChange(true); return; }
    if (controller) return;
    const request = new AbortController();
    controller = request;
    const timeout = setTimeout(() => request.abort(), 6000);
    try {
      // navigator.onLine can remain true on a Wi-Fi network without internet.
      // This public endpoint has no auth or paid-provider side effects.
      await fetcher('/api/health', { cache: 'no-store', signal: request.signal });
      if (!disposed && !request.signal.aborted) onChange(false);
    } catch { if (!disposed) onChange(true); }
    finally { clearTimeout(timeout); if (controller === request) controller = null; }
  };
  for (const event of ['online', 'offline', 'focus']) browser.addEventListener(event, check);
  check();
  return { check, dispose() {
    disposed = true;
    controller?.abort();
    for (const event of ['online', 'offline', 'focus']) browser.removeEventListener(event, check);
  } };
}

export function registerPwa({ onUpdate, browser = window, client = navigator.serviceWorker }) {
  let disposed = false;
  let registration;
  let installing;
  const notify = () => {
    if (!disposed && registration?.waiting) onUpdate(registration.waiting);
  };
  const stateChanged = () => { if (installing?.state === 'installed') notify(); };
  const updateFound = () => {
    installing?.removeEventListener('statechange', stateChanged);
    installing = registration.installing;
    installing?.addEventListener('statechange', stateChanged);
  };
  const check = () => { if (browser.navigator.onLine) registration?.update().catch(() => {}); };
  const start = async () => {
    try {
      registration = await client.register('/sw.js', { updateViaCache: 'none' });
      if (disposed) return;
      notify();
      registration.addEventListener('updatefound', updateFound);
      updateFound();
    } catch { /* Installation failure must not block the online app. */ }
  };
  if (browser.document.readyState === 'complete') start();
  else browser.addEventListener('load', start, { once: true });
  browser.addEventListener('online', check);
  browser.addEventListener('focus', check);
  return () => {
    disposed = true;
    browser.removeEventListener('load', start);
    browser.removeEventListener('online', check);
    browser.removeEventListener('focus', check);
    registration?.removeEventListener('updatefound', updateFound);
    installing?.removeEventListener('statechange', stateChanged);
  };
}
