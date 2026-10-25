import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { wardrobeApi } from "./scripts/api-handler.mjs";
import { wardrobePwa } from "./scripts/pwa-plugin.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    optimizeDeps: {
      // p-retry contains a CommonJS dependency (retry) that still needs interop.
      include: ["react", "react-dom/client", "@decartai/sdk > p-retry"],
      // This ESM SDK resolves its frame-metadata worker relative to import.meta.url.
      // Prebundling relocates the module without copying the worker, breaking video.
      exclude: ["@decartai/sdk"],
    },
    server: {
      fs: { deny: ['.env', '.env.*', '**/.git/**', '**/data/**', '**/*.{crt,pem,key}'] },
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      warmup: {
        clientFiles: ["./src/main.jsx"],
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
      allowedHosts: ["localhost"],
    },
    plugins: [react(), wardrobeApi({ env }), wardrobePwa()],
  };
});
