import path from 'node:path';
import { accountApi, sendJson } from './account-api.mjs';
import { cloudWardrobeApi } from './cloud-wardrobe-api.mjs';
import { wardrobeImportApi } from './import-job-api.mjs';
import { wardrobeTryOnApi } from './try-on-api.mjs';
import { decartApi } from './decart-api.mjs';

// The same protected API runs in Vite and in the Vercel Node function.
export async function createApiHandler({ env = process.env, plugins, root = process.cwd() } = {}) {
  const chain = [];
  const configured = plugins || [accountApi({ env }), cloudWardrobeApi(), wardrobeImportApi({ env, backgroundOnly: true }), wardrobeTryOnApi({ env, accountStorage: true }), decartApi({ env })];
  for (const plugin of configured) {
    await plugin.configResolved?.({ root, publicDir: path.join(root, 'public') });
    plugin.configureServer({ middlewares: { use(handler) { chain.push(handler); } } });
  }
  return async (req, res) => {
    try {
      if (req.url === '/api/health' && req.method === 'GET') return sendJson(res, 200, { status: 'ok', service: 'thefit' });
      let index = 0;
      const dispatch = async () => {
        const fn = chain[index++];
        if (!fn) return sendJson(res, 404, { error: 'Not found.' });
        let following;
        await fn(req, res, () => { following = dispatch(); });
        await following;
      };
      await dispatch();
    } catch {
      if (!res.headersSent) return sendJson(res, 500, { error: 'The request could not be completed. Please try again.' });
      if (!res.writableEnded) res.end();
    }
  };
}

export function wardrobeApi({ env = {} } = {}) {
  let ready;
  const attach = server => {
    server.middlewares.use(async (req, res, next) => {
      if (!new URL(req.url, 'http://localhost').pathname.startsWith('/api/')) return next();
      await (await ready)(req, res);
    });
  };
  return { name: 'thefit-api', configResolved(config) { ready = createApiHandler({ env, root: config.root }); }, configureServer: attach, configurePreviewServer: attach };
}
