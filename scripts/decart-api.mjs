import { createDecartClient } from "@decartai/sdk";

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

export function decartApi(options = {}) {
  let apiKey = "";

  async function handler(req, res, next) {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/api/decart/token") return next();
    if (req.method !== "POST") return json(res, 405, { error: "Use POST." });
    if (!apiKey.trim()) return json(res, 503, { error: "Decart is not configured. Add DECART_API_KEY and restart the server." });

    try {
      const client = createDecartClient({ apiKey });
      const token = await client.tokens.create({
        expiresIn: 120,
        allowedModels: ["lucy-vton-3.6"],
        constraints: { realtime: { maxSessionDuration: 90 } },
      });
      return json(res, 200, token);
    } catch (error) {
      const status = error?.data?.status;
      if (status === 401 || status === 403) {
        return json(res, 503, { error: "Decart rejected the API key. Replace DECART_API_KEY with a valid permanent key in .env.local, then restart the server." });
      }
      if (status === 402) {
        return json(res, 503, { error: "Decart credits are unavailable. Check your Decart account balance before trying again." });
      }
      if (status === 429) {
        return json(res, 429, { error: "Decart's request limit was reached. Wait before starting another session." });
      }
      return json(res, 502, { error: "Could not start the Decart session. Please try again." });
    }
  }

  return {
    name: "wardrobe-decart-api",
    apply: "serve",
    configResolved() {
      // Keep the permanent key server-side; only short-lived tokens reach clients.
      apiKey = (options.env?.DECART_API_KEY || process.env.DECART_API_KEY || "").trim();
    },
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}
