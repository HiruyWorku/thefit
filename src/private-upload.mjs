import { supabase } from './supabaseClient.js';

const BUCKET = 'wardrobe-private';

export async function normalizePhoto(source) {
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width * bitmap.height > 40000000) throw new Error('Choose a photo under 40 megapixels.');
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare this photo.')), 'image/png'));
  } finally { bitmap.close(); }
}

export async function uploadPrivatePhoto(source, kind = 'items', { client = supabase, normalize = normalizePhoto, uuid = () => crypto.randomUUID() } = {}) {
  if (kind !== 'items' && kind !== 'reference') throw new Error('Choose a valid photo type.');
  if (!client) throw new Error('Sign-in is not configured. Please configure Supabase.');
  const { data, error } = await client.auth.getSession();
  const userId = data?.session?.user?.id;
  if (error || !userId) throw new Error('Please log in again before uploading.');
  // Already-private prepared photos can be reused without transferring them again.
  const existing = typeof source === 'string' && source.match(/^\/api\/import\/library\/(import-[a-f0-9-]{36}-garment\.png)$/);
  if (kind === 'items' && existing) return { imagePath: `items/${existing[1]}` };
  const photo = await normalize(source);
  if (photo.size > 25 * 1024 * 1024) throw new Error('Choose a smaller photo.');
  const filename = kind === 'items' ? `import-${uuid()}-garment.png` : `${uuid()}.png`;
  const imagePath = `${kind}/${filename}`;
  const uploaded = await client.storage.from(BUCKET).upload(`${userId}/${imagePath}`, photo, { contentType: 'image/png', upsert: false, cacheControl: '0' });
  if (uploaded.error) throw new Error('Could not upload this photo to your private storage. Please try again.');
  return { imagePath };
}
