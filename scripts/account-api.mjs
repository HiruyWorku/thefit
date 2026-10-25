import { createClient } from '@supabase/supabase-js';

const COOKIE = 'thefit_session';
export const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(JSON.stringify(body));
};

export function accountApi({ env = {}, clientFactory = createClient } = {}) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  const verifier = url && key ? clientFactory(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const cookie = (req, token = '', age = 0) => `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${req.socket?.encrypted || env.APP_HTTPS === 'true' ? '; Secure' : ''}`;
  async function handler(req, res, next) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Cookie, Authorization');
    // Cookie authentication must not authorize cross-site writes.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      let foreignOrigin = false;
      try { foreignOrigin = !!origin && new URL(origin).host !== req.headers.host; } catch { foreignOrigin = true; }
      if (req.headers['sec-fetch-site'] === 'cross-site' || foreignOrigin) return sendJson(res, 403, { error: 'Open this app directly to make changes.' });
    }
    if (pathname === '/api/auth/session' && req.method === 'DELETE') {
      res.setHeader('Set-Cookie', cookie(req));
      return sendJson(res, 200, { signedOut: true });
    }
    if (!verifier) return sendJson(res, 503, { error: 'Account storage is not configured. Add the Supabase settings and restart the server.' });
    const bearer = req.headers.authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
    let token = bearer;
    if (!token) {
      try { token = decodeURIComponent(req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || ''); }
      catch { return sendJson(res, 401, { error: 'Please log in again.' }); }
    }
    if (!token) return sendJson(res, 401, { error: 'Log in to access your wardrobe.' });
    try {
      // Verification is performed by Supabase, never by decoding an unverified JWT.
      const { data, error } = await verifier.auth.getClaims(token);
      const claims = data?.claims;
      if (error || !claims?.sub || claims.role !== 'authenticated' || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) return sendJson(res, 401, { error: 'Your session expired. Please log in again.' });
      if (pathname === '/api/auth/session') {
        if (req.method !== 'POST' || !bearer) return sendJson(res, 405, { error: 'Use an authenticated POST.' });
        res.setHeader('Set-Cookie', cookie(req, token, Math.max(1, Math.floor(claims.exp - Date.now() / 1000))));
        return sendJson(res, 200, { userId: claims.sub });
      }
      req.account = { userId: claims.sub, client: clientFactory(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } }) };
      return next();
    } catch { return sendJson(res, 503, { error: 'Could not verify your session. Please try again.' }); }
  }
  return { name: 'account-api', configureServer(server) { server.middlewares.use(handler); }, configurePreviewServer(server) { server.middlewares.use(handler); } };
}
