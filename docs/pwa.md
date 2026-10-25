# PWA installation and offline behavior

thefit is a web app that can be installed from an HTTPS deployment. No app store, push service, extra paid provider, or new API key is needed.

## Installation

- Chrome/Edge desktop and Android: select **Install thefit** and accept the browser installer. If the browser does not offer a native prompt, the button displays installation instructions.
- iPhone/iPad: open in Safari and choose **Share → Add to Home Screen → Add**.
- Safari on Mac: choose **File → Add to Dock**.

The manifest uses a stable `/` application ID, starts at `/app`, and runs in standalone display mode. Existing authentication still protects the wardrobe. Apple touch, 192px, 512px and maskable icons use the existing thefit brand mark. Regenerate committed icons after a brand asset change with `node scripts/generate-pwa-icons.mjs`.

## Caching and privacy

`wardrobePwa()` in `vite.config.mjs` generates `dist/sw.js` from `scripts/pwa-worker.js`. Its cache version hashes the worker template and every cached public file. The precache contains the built HTML, local JavaScript/CSS/font chunks, manifest, icons and public landing-page logo. This also covers lazy-loaded JavaScript needed to render the interface.

Only `/` and `/app` navigations use the installed HTML shell. Only explicit precache entries use cached assets. API requests, writes, image proxies, account photos and cross-origin URLs bypass the service worker. No private offline snapshots or background upload queue are created. Signing out retains only public app files in Cache Storage. Activation removes prior thefit caches, including older image/data caches, and preserves unrelated applications' caches.

External decorative landing-page images and external fonts may be unavailable offline; the local interface and fallback fonts remain usable. Account data, authentication refresh, uploads, outfit saves, weather and try-on require a connection. The offline notice is available on both the landing page and protected route, including during authentication errors.

Connectivity checks use the public `/api/health` endpoint at startup, reconnection, window focus or an explicit **Retry connection**. This detects failed connections even when `navigator.onLine` incorrectly reports online. There is no background polling or paid API call.

## Updates

The new worker waits after installation. `PwaControls` offers **Update app** or **Later**. Only the explicit update action sends `SKIP_WAITING`; that tab reloads after the replacement worker takes control. A different tab taking control does not force this tab to reload. Registration/update failures do not prevent normal online use. Reconnection and focus check for updates. Vercel serves the worker and manifest with `Cache-Control: no-cache`.

## Verify a production build

1. Run `npm run check`, then `npm run preview` and open `http://localhost:4173` (or use the HTTPS deployment). Development mode deliberately does not register a worker.
2. In Chrome DevTools → Application, confirm the manifest, icons, scope and active worker. Install from the browser menu or the app's install button. Native install prompts depend on browser support and eligibility.
3. Visit once online, wait for the worker to activate, then switch DevTools Network to Offline. Reload `/` and `/app`: the app shell and offline message should appear. Private wardrobe records/photos should not appear in Cache Storage.
4. Return online, build a new version and refresh/check for updates. Confirm the update notice appears, **Later** preserves the page, and **Update app** activates the new version and reloads.
5. Check the installation instructions and offline notice on a narrow viewport and confirm they do not block the Add clothes control.

Worker tests cover offline navigation/assets, private request exclusions, old-cache cleanup and explicit update activation. Registration tests cover first installation, update notifications, reconnection, cleanup and registration failure. Browser validation should use a fresh profile so an older worker does not hide the current build.
