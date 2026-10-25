export const BUCKET = 'wardrobe-private';
const fail = (message, status = 500) => Object.assign(new Error(message), { status });
export function cloudWardrobeStore({ client, userId }) {
  const check = result => {
    if (result.error) {
      if (['42P01', 'PGRST205', 'PGRST204'].includes(result.error.code)) throw fail('Account storage needs setup. Run the Supabase migration in docs/authentication.md.', 503);
      throw fail('Could not access your account storage. Please try again.');
    }
    return result.data;
  };
  const objectPath = name => {
    if (!/^(?:items\/[\w-]+\.png|fits\/[a-f0-9-]{36}-(?:[0-4]|preview)\.png|reference\/[a-f0-9-]{36}\.png|previews\/[a-f0-9]{64}\.png)$/.test(name)) throw fail('Invalid image path.', 400);
    return `${userId}/${name}`;
  };
  const query = table => client.from(table);
  return {
    async listItems() { return (check(await query('wardrobe_garments').select('record').eq('user_id', userId).order('created_at')) || []).map(row => row.record); },
    async item(id) { return check(await query('wardrobe_garments').select('record').eq('user_id', userId).eq('id', id).maybeSingle())?.record || null; },
    async putItem(record) { check(await query('wardrobe_garments').upsert({ user_id: userId, id: record.id, record }, { onConflict: 'user_id,id' })); return record; },
    async deleteItem(id) { check(await query('wardrobe_garments').delete().eq('user_id', userId).eq('id', id)); },
    async listFits() { return (check(await query('wardrobe_fits').select('record').eq('user_id', userId).order('created_at', { ascending: false })) || []).map(row => row.record); },
    async fitByFingerprint(fingerprint) { return check(await query('wardrobe_fits').select('record').eq('user_id', userId).eq('fingerprint', fingerprint).maybeSingle())?.record || null; },
    async putFit(record) { check(await query('wardrobe_fits').upsert({ user_id: userId, id: record.id, fingerprint: record.fingerprint, record }, { onConflict: 'user_id,fingerprint' })); return record; },
    async reference() { return check(await query('wardrobe_settings').select('reference_path').eq('user_id', userId).maybeSingle())?.reference_path || null; },
    async setReference(reference_path) { check(await query('wardrobe_settings').upsert({ user_id: userId, reference_path })); },
    async readImage(name) {
      const result = await client.storage.from(BUCKET).download(objectPath(name));
      if (result.error) {
        const missing = String(result.error.statusCode || result.error.status) === '404' || /not found|does not exist/i.test(result.error.message || '');
        throw fail(missing ? 'This account photo could not be found.' : 'Could not reach your private photos. Please try again.', missing ? 404 : 503);
      }
      return Buffer.from(await result.data.arrayBuffer());
    },
    async imageUrl(name) {
      const result = await client.storage.from(BUCKET).createSignedUrl(objectPath(name), 60);
      if (result.error || !result.data?.signedUrl) {
        const missing = /not found|does not exist/i.test(result.error?.message || '') || String(result.error?.statusCode) === '404';
        throw fail(missing ? 'This account photo could not be found.' : 'Could not open your private photo.', missing ? 404 : 503);
      }
      return result.data.signedUrl;
    },
    async writeImage(name, bytes) {
      check(await client.storage.from(BUCKET).upload(objectPath(name), bytes, { contentType: 'image/png', upsert: false, cacheControl: '0' }));
    },
    async removeImages(names) { if (names.length) check(await client.storage.from(BUCKET).remove(names.map(objectPath))); },
  };
}
