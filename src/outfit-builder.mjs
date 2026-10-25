import { getGarmentType } from './garment-types.mjs';

export const BUILDER_STORAGE_KEY = 'the-fit-outfit-draft-v1';
export const OUTFIT_DRAG_TYPE = 'application/x-the-fit-garment';
export const BUILDER_SLOTS = [
  { id: 'top', label: 'Top', part: 'upperbody', required: false, prompt: 'Choose a top' },
  { id: 'bottoms', label: 'Bottoms', part: 'lowerbody', required: false, prompt: 'Choose bottoms' },
  { id: 'shoes', label: 'Footwear', part: 'shoes', required: false, prompt: 'Choose footwear' },
  { id: 'jacket', label: 'Outerwear', part: 'wholebody_up', required: false, prompt: 'Add an outer layer' },
  { id: 'hat', label: 'Headwear', part: 'headwear', required: false, prompt: 'Add headwear' },
];
const slotIds = new Set(BUILDER_SLOTS.map(slot => slot.id));
const presentation = [['hat', 'Hat'], ['top', 'Top'], ['jacket', 'Jacket'], ['bottoms', 'Bottoms'], ['shoes', 'Shoes']];

export function builderSlotFor(item) {
  const role = getGarmentType(item)?.role;
  return slotIds.has(role) ? role : null;
}

export function parseBuilderDraft(raw) {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(BUILDER_SLOTS.flatMap(({ id }) => typeof value[id] === 'string' && value[id].length > 0 && value[id].length <= 160 ? [[id, value[id]]] : []));
  } catch { return {}; }
}

export function addBuilderItem(selection, item, targetSlot = null) {
  const slot = builderSlotFor(item);
  if (!slot || typeof item?.id !== 'string' || !item.id.trim() || (targetSlot && targetSlot !== slot)) return null;
  const next = { ...selection };
  for (const key of Object.keys(next)) if (next[key] === item.id) delete next[key];
  return { ...next, [slot]: item.id };
}

export function resolveBuilderOutfit(selection, items) {
  const inventory = new Map(items.map(item => [item.id, item]));
  const valid = {};
  for (const { id } of BUILDER_SLOTS) {
    const item = inventory.get(selection[id]);
    if (item && builderSlotFor(item) === id) valid[id] = item;
  }
  const missing = BUILDER_SLOTS.filter(slot => slot.required && !valid[slot.id]).map(slot => slot.label);
  return {
    chosen: presentation.flatMap(([id, label]) => valid[id] ? [{ slot: label, item: valid[id], reason: 'Chosen by you.' }] : []),
    bySlot: valid,
    missing,
    complete: Object.keys(valid).length > 0,
  };
}

export function customizeOutfit(outfit) {
  return (outfit?.chosen || []).reduce((selection, { item }) => addBuilderItem(selection, item) || selection, {});
}
