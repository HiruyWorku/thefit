import { createApiHandler } from '../scripts/api-handler.mjs';

const ready = createApiHandler();
export default async function handler(req, res) {
  // Keep the original path when all API URLs are routed to this one function.
  const route = req.query?.__route;
  if (typeof route === 'string') req.url = `/api/${route}`;
  return (await ready)(req, res);
}
