import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Build the offline shell from the actual output, including hashed JS, CSS and fonts.
export function wardrobePwa() {
  let config;
  return {
    name: "wardrobe-pwa",
    apply: "build",
    configResolved(value) { config = value; },
    async generateBundle() {
      for (const size of [180, 192, 512]) {
        const source = await sharp(path.join(config.publicDir, "icon.svg"))
          .resize(size, size).flatten({ background: "#f4f0e8" }).png().toBuffer();
        this.emitFile({ type: "asset", fileName: `icons/icon-${size}.png`, source });
      }
    },
    async closeBundle() {
      const output = path.resolve(config.root, config.build.outDir);
      const files = ["index.html", "manifest.webmanifest", "icon.svg"];
      for (const directory of ["assets", "icons"]) {
        for (const file of await readdir(path.join(output, directory), { recursive: true })) {
          if (path.extname(file)) files.push(`${directory}/${file}`);
        }
      }
      files.sort();
      const hash = createHash("sha256");
      const template = await readFile(new URL("./pwa-worker.js", import.meta.url), "utf8");
      hash.update(template);
      for (const file of files) { hash.update(file); hash.update(await readFile(path.join(output, file))); }
      const worker = template.replace('"__BUILD_VERSION__"', JSON.stringify(hash.digest("hex").slice(0, 16)))
        .replace('"__PRECACHE_FILES__"', JSON.stringify(files.map((file) => `/${file}`)));
      await writeFile(path.join(output, "sw.js"), worker);
    },
  };
}
