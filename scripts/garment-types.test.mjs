import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { filterWardrobe, getGarmentType, getItemCategory, validGarmentType } from '../src/garment-types.mjs';
import { profileGarment } from '../src/garment-profile.mjs';

test('category and garment type filters count visible items rather than the full 53-piece wardrobe', () => {
  const rows = Array.from({ length: 53 }, (_, index) => ({
    id: String(index), name: 'My piece', part: index < 17 ? 'upperbody' : index < 29 ? 'wholebody_up' : 'lowerbody',
    garmentType: index < 8 ? 't-shirt' : index < 17 ? 'hoodie' : index < 29 ? 'puffer-jacket' : 'jeans',
  }));
  assert.equal(filterWardrobe(rows).length, 53);
  assert.equal(filterWardrobe(rows, 'upperbody').length, 17);
  assert.equal(filterWardrobe(rows, 'upperbody', 'hoodie').length, 9);
  assert.equal(filterWardrobe(rows, 'wholebody_up').length, 12);
  assert.equal(filterWardrobe(rows, 'lowerbody', 'shorts').length, 0);
});

test('legacy outerwear and headwear are grouped correctly without editing stored items', () => {
  const puffer = { id: 'p', name: 'Puffer jacket', part: 'upperbody' };
  const cap = { id: 'c', name: 'Navy baseball cap', part: 'accessories_up' };
  const bag = { id: 'b', name: 'Canvas bag', part: 'accessories_up' };
  assert.equal(getItemCategory(puffer), 'wholebody_up');
  assert.equal(getItemCategory(cap), 'headwear');
  assert.equal(getItemCategory(bag), 'accessories_up');
  assert.equal(profileGarment(bag), null);
  assert.equal(puffer.part, 'upperbody');
});

test('explicit garment types guide recommendations even when names disagree', () => {
  const shirt = { id: 'shirt', name: 'Puffer jacket', part: 'upperbody', garmentType: 't-shirt' };
  assert.equal(getGarmentType(shirt).id, 't-shirt');
  assert.equal(profileGarment(shirt).role, 'top');
  assert.equal(profileGarment(shirt).warmth, .7);
  assert.equal(validGarmentType('upperbody', 'puffer-jacket'), false);
  assert.equal(validGarmentType('headwear', 'cap'), true);
  assert.equal(validGarmentType('upperbody', '__proto__'), false);
});

test('all bundled garments have a valid specific type and legacy libraries resolve them', async () => {
  const rows = JSON.parse(await readFile(new URL('../sample-wardrobe/library.json', import.meta.url), 'utf8'));
  for (const row of rows) {
    assert.ok(row.garmentType, row.name);
    assert.ok(validGarmentType(row.part, row.garmentType), row.name);
    const { garmentType, ...legacy } = row;
    assert.equal(getGarmentType(legacy).id, garmentType, row.name);
  }
});
