import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBuilderItem, builderSlotFor, customizeOutfit, parseBuilderDraft, resolveBuilderOutfit } from '../src/outfit-builder.mjs';
import { cachedOutfitPreview, outfitPreviewKey, requestOutfitPreview } from '../src/outfit-preview.mjs';

const piece = (id, part, name, garmentType) => ({ id, part, name, garmentType, image: `/${id}.png`, tags: [] });
const items = [piece('tee', 'upperbody', 'Navy T-shirt', 't-shirt'), piece('shirt', 'upperbody', 'White shirt', 'shirt'),
  piece('jeans', 'lowerbody', 'Dark jeans', 'jeans'), piece('sneakers', 'shoes', 'Leather sneakers', 'sneakers'),
  piece('puffer', 'upperbody', 'Puffer jacket'), piece('cap', 'accessories_up', 'Baseball cap'), piece('bag', 'accessories_up', 'Bag')];

test('all five slots are optional and any nonempty fit is ready, with at most one piece in each role', () => {
  let draft = {};
  assert.equal(resolveBuilderOutfit(draft, items).complete, false);
  assert.equal(resolveBuilderOutfit({ shoes: 'sneakers' }, items).complete, true);
  for (const index of [0, 2, 3, 4, 5]) {
    assert.equal(resolveBuilderOutfit(addBuilderItem({}, items[index]), items).complete, true);
    draft = addBuilderItem(draft, items[index]);
  }
  const outfit = resolveBuilderOutfit(draft, items);
  assert.equal(outfit.complete, true);
  assert.equal(outfit.chosen.length, 5);
  assert.deepEqual(outfit.chosen.map(entry => entry.slot), ['Hat', 'Top', 'Jacket', 'Bottoms', 'Shoes']);
  const replaced = resolveBuilderOutfit(addBuilderItem(draft, items[1]), items);
  assert.equal(replaced.chosen.length, 5);
  assert.equal(replaced.bySlot.top.id, 'shirt');
});

test('misclassified jackets cannot be dropped into tops and accessories cannot become headwear', () => {
  assert.equal(builderSlotFor(items[4]), 'jacket');
  assert.equal(addBuilderItem({}, items[4], 'top'), null);
  assert.equal(addBuilderItem({}, items[6]), null);
  assert.equal(addBuilderItem({}, undefined), null);
  assert.deepEqual(addBuilderItem({}, items[5], 'hat'), { hat: 'cap' });
});

test('removal, deleted items and recategorization empty their slots without stale photos or IDs', () => {
  const draft = { top: 'tee', bottoms: 'jeans', shoes: 'sneakers' };
  assert.equal(resolveBuilderOutfit(draft, items).complete, true);
  assert.equal(resolveBuilderOutfit({ ...draft, top: undefined }, items).bySlot.top, undefined);
  const deleted = resolveBuilderOutfit(draft, items.filter(item => item.id !== 'jeans'));
  assert.equal(deleted.complete, true);
  assert.ok(!deleted.chosen.some(entry => entry.item.id === 'jeans'));
  const recategorized = items.map(item => item.id === 'tee' ? { ...item, garmentType: 'puffer-jacket', part: 'wholebody_up' } : item);
  assert.equal(resolveBuilderOutfit(draft, recategorized).bySlot.top, undefined);
});

test('drafts contain only allowed slot IDs and tolerate corrupted device storage', () => {
  assert.deepEqual(parseBuilderDraft('{bad'), {});
  assert.deepEqual(parseBuilderDraft('null'), {});
  assert.deepEqual(parseBuilderDraft('[]'), {});
  assert.deepEqual(parseBuilderDraft(JSON.stringify({ top: 'tee', shoes: null, secret: 'not stored', hat: 123 })), { top: 'tee' });
  const draft = { top: 'tee', bottoms: 'jeans', shoes: 'sneakers' };
  assert.equal(resolveBuilderOutfit(parseBuilderDraft(JSON.stringify(draft)), items).complete, true);
});

test('customizing a suggestion copies its IDs, retains optional layers and follows live wardrobe edits', () => {
  const chosen = items.slice(0, 6).filter(item => item.id !== 'shirt').map(item => ({ item }));
  const draft = customizeOutfit({ chosen });
  assert.equal(draft.jacket, 'puffer');
  assert.equal(draft.hat, 'cap');
  const changed = items.map(item => item.id === 'tee' ? { ...item, name: 'Renamed top' } : item);
  assert.equal(resolveBuilderOutfit(draft, changed).bySlot.top.name, 'Renamed top');
});

test('only an explicit preview request sends the custom IDs, deduplicates and reuses completed previews', async () => {
  const outfit = resolveBuilderOutfit({ top: 'tee', bottoms: 'jeans', shoes: 'sneakers' }, items);
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(url, '/api/outfits/try-on');
    assert.deepEqual(JSON.parse(options.body), { itemIds: ['tee', 'jeans', 'sneakers'] });
    return { ok: true, json: async () => ({ imageDataUrl: 'data:image/png;base64,mocked' }) };
  };
  const key = outfitPreviewKey(outfit);
  assert.equal(calls, 0);
  assert.equal(cachedOutfitPreview(outfit), null);
  const results = await Promise.all([requestOutfitPreview(outfit, fetcher), requestOutfitPreview(outfit, fetcher)]);
  assert.equal(calls, 1);
  assert.equal(results[0], results[1]);
  assert.equal(await requestOutfitPreview(outfit, fetcher), results[0]);
  assert.equal(calls, 1);
  assert.notEqual(outfitPreviewKey(resolveBuilderOutfit({ top: 'shirt', bottoms: 'jeans', shoes: 'sneakers' }, items)), key);
});

test('invalid photo-preview payloads never call a provider and failed requests can be retried', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return { ok: false, json: async () => ({ error: 'Preview unavailable' }) }; };
  await assert.rejects(requestOutfitPreview({ chosen: [] }, fetcher), /unique/);
  await assert.rejects(requestOutfitPreview({ chosen: [{ item: items[0] }, { item: items[0] }] }, fetcher), /unique/);
  assert.equal(calls, 0);
  const outfit = resolveBuilderOutfit({ top: 'shirt' }, items);
  await assert.rejects(requestOutfitPreview(outfit, fetcher), /Preview unavailable/);
  await assert.rejects(requestOutfitPreview(outfit, fetcher), /Preview unavailable/);
  assert.equal(calls, 2);
});
