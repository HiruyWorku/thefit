import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { seedWardrobe } from './seed-wardrobe.mjs';

test('sample wardrobe installs all garments and credits, preserving user edits on repeat imports', async t => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'wardrobe-seed-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const first = await seedWardrobe({ dataDir });
  assert.equal(first.added, 41);
  const file = path.join(dataDir, 'library.json');
  const rows = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(new Set(rows.map(row => row.id)).size, 41);
  for (const row of rows) {
    const filename = row.image.split('/').pop();
    const [source, saved] = await Promise.all([
      readFile(new URL(`../sample-wardrobe/imported/${filename}`, import.meta.url)),
      readFile(path.join(dataDir, 'imported', filename)),
    ]);
    assert.ok(source.equals(saved));
  }
  const credits = JSON.parse(await readFile(path.join(dataDir, 'catalog-attributions.json'), 'utf8'));
  assert.equal(credits.items.length, 28);
  assert.ok(credits.items.every(row => rows.some(item => item.id === row.id) && row.license === 'CC BY-NC 4.0'));
  rows[0].name = 'My edited garment';
  rows.push({ id: 'user-piece', name: 'My own photo' });
  // A partially populated wardrobe should gain only the one missing sample.
  const missing = rows.splice(1, 1)[0];
  await writeFile(file, JSON.stringify(rows));
  assert.equal((await seedWardrobe({ dataDir })).added, 1);
  const merged = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(merged.length, 42);
  assert.equal(merged[0].name, 'My edited garment');
  assert.ok(merged.some(row => row.id === 'user-piece'));
  assert.equal(merged.filter(row => row.id === missing.id).length, 1);
  assert.equal((await seedWardrobe({ dataDir })).added, 0);
  assert.equal(JSON.parse(await readFile(path.join(dataDir, 'catalog-attributions.json'), 'utf8')).items.length, 28);
});
