import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('../public/icons/', import.meta.url);
await mkdir(directory, { recursive: true });
const logo = await sharp(fileURLToPath(new URL('../public/branding/thefit-icon.png', import.meta.url)))
  .trim().png().toBuffer();
for (const [name, size, fraction] of [
  ['icon-180.png', 180, .78], ['icon-192.png', 192, .78],
  ['icon-512.png', 512, .78], ['icon-maskable-512.png', 512, .6],
]) {
  const mark = await sharp(logo).resize({ width: Math.round(size * fraction), height: Math.round(size * fraction), fit: 'inside' }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#f4f0e8' } })
    .composite([{ input: mark, gravity: 'centre' }]).png().toFile(fileURLToPath(new URL(name, directory)));
}
