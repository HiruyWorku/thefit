// Explicit garment types lead; names/tags and legacy categories are fallbacks.
// are conservative styling heuristics, not measurements of insulation or fit.
import { getGarmentType, CATEGORY_MAP, GARMENT_TYPE_MAP } from './garment-types.mjs';
const normalize = value => typeof value === 'string' ? value.toLowerCase().replace(/[-_\u2010-\u2015]/g, ' ').replace(/\s+/g, ' ').trim() : '';

export function colorProfile(hex) {
  if (typeof hex !== 'string' || !/^#[\da-f]{6}$/i.test(hex)) return null;
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), chroma = max - min;
  const lightness = (max + min) / 2;
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (chroma) hue = ((max === r ? (g - b) / chroma : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4) * 60 + 360) % 360;
  const neutral = chroma < .10 || lightness < .12 || lightness > .92
    || (hue >= 200 && hue <= 260 && lightness < .30 && chroma < .25)
    || (hue >= 20 && hue <= 70 && saturation < .45);
  return { hue, saturation, lightness, neutral, bright: !neutral && saturation > .55 && lightness > .3 };
}

export function profileGarment(item) {
  if (!item || typeof item.id !== 'string' || !item.id.trim()) return null;
  const name = normalize(item.name);
  const tags = Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === 'string').map(normalize) : [];
  const type = getGarmentType(item);
  const explicit = Object.hasOwn(GARMENT_TYPE_MAP, item.garmentType) && !item.garmentType.startsWith('other-');
  const text = [normalize(type?.label), ...(explicit ? [] : [name]), ...tags].join(' ');
  // A product named "low-top sneakers" is footwear, not a top. Names give
  // stronger type evidence than incidental tags such as "wear under jacket".
  const role = type?.role;
  if (!role || role === 'accessory') return null; // Bags, belts and scarves aren't hats.
  const has = pattern => pattern.test(text);
  const puffer = has(/\b(puffer|parka|down|insulated|winter coat)\b/);
  const shell = has(/\b(rain\s?(jacket|coat)|rain shell|shell|windbreaker|waterproof|water resistant)\b/);
  const warmKnit = has(/\b(sweater|sweatshirt|hoodie|cardigan|fleece|thermal|wool|cashmere)\b/);
  const shortSleeve = has(/\b(t shirt|tshirt|tee|tank|polo|short sleeve)\b/);
  const shortBottom = role === 'bottoms' && has(/\b(shorts|mini skirt)\b/);
  const openShoe = role === 'shoes' && has(/\b(sandals?|slides?|flip flops?)\b/);
  const mesh = role === 'shoes' && has(/\b(mesh|knit|running|athletic)\b/);
  const leather = has(/\bleather\b/);
  const waterproof = has(/\bwaterproof\b/) && !has(/\b(not|non) waterproof\b/);
  const resistant = has(/\bwater resistant\b/) && !has(/\b(not|non) water resistant\b/);
  let warmth = 0, formality = .5;
  if (role === 'top') {
    warmth = warmKnit ? 2.4 : has(/\blong sleeve\b/) ? 1.6 : shortSleeve ? .7 : 1.2;
    formality = has(/\b(polo|button down|button up|dress shirt|oxford|blouse)\b/) ? 1.3 : .3;
  } else if (role === 'jacket') {
    warmth = puffer ? 3.5 : has(/\bwool\b/) ? 3 : shell ? .9 : leather ? 1.8 : 1.6;
    formality = has(/\b(blazer|overcoat|trench|wool coat)\b/) ? 1.8 : .5;
  } else if (role === 'bottoms') {
    warmth = shortBottom ? .2 : has(/\b(fleece|thermal|wool)\b/) ? 2.2 : 1.2;
    formality = has(/\b(tailored|formal|dress pants|trousers|chinos)\b/) ? 1.8 : .5;
  } else if (role === 'shoes') {
    warmth = openShoe ? .1 : has(/\bboots?\b/) ? 2 : mesh ? .6 : 1.2;
    formality = has(/\b(loafers?|oxfords?|dress shoes?)\b/) ? 2 : leather ? 1 : mesh ? -1 : .4;
  } else warmth = has(/\b(beanie|wool|winter|thermal)\b/) ? 2 : .2;
  const sporty = has(/\b(athletic|running|gym|training|sports?|track|joggers|sweatpants)\b/);
  if (sporty && role !== 'jacket') formality = -1;
  const rainProtection = waterproof ? 3 : resistant ? 2 : role === 'jacket' && shell ? 2 : role === 'shoes' && !openShoe && !mesh ? 1 : .1;
  const details = [name, ...tags].join(' ');
  const smartTop = ['shirt', 'polo', 'blouse', 'sweater', 'cardigan'].includes(type.id)
    && !sporty && !/\b(graphic|printed|floral|pattern|distressed)\b/.test(details);
  const smartBottoms = ['trousers', 'chinos'].includes(type.id)
    || (type.id === 'jeans' && /\b(dark|indigo|black)\b/.test(details) && !/\b(distressed|ripped|faded|baggy)\b/.test(details))
    || (type.id === 'skirt' && !/\b(mini|denim|athletic)\b/.test(details));
  const smartShoes = ['loafers', 'dress-shoes'].includes(type.id)
    || (type.id === 'sneakers' && /\b(leather|minimal|minimalist|clean)\b/.test(details) && !sporty && !mesh)
    || (type.id === 'boots' && /\b(chelsea|dress|chukka)\b/.test(details) && !/\b(work|combat|hiking)\b/.test(details));
  const activeTop = ['t-shirt', 'tank-top', 'long-sleeve-top', 'thermal', 'hoodie', 'sweatshirt'].includes(type.id);
  const activeBottoms = ['joggers', 'leggings'].includes(type.id) || (type.id === 'shorts' && sporty);
  const activeShoes = type.id === 'running-shoes' || (type.id === 'sneakers' && sporty);
  return {
    item, garmentType: type.id, role, warmth, formality, shortSleeve, shortBottom, openShoe, mesh, puffer, shell, sporty,
    smartSuitable: role === 'top' ? smartTop : role === 'bottoms' ? smartBottoms && !sporty : role === 'shoes' ? smartShoes : true,
    activeSuitable: role === 'top' ? activeTop : role === 'bottoms' ? activeBottoms : role === 'shoes' ? activeShoes : true,
    rainProtection, waterproof, color: colorProfile(item.color),
    patterned: has(/\b(graphic|printed|print|plaid|floral|striped|pattern)\b/),
    categoryCorrected: !!CATEGORY_MAP[item.part] && type.part !== item.part,
  };
}

export function colorCompatibility(first, second) {
  if (!first || !second) return 0; // Unknown colors never get invented.
  if (first.neutral || second.neutral) return .5;
  const delta = Math.abs(first.hue - second.hue);
  const distance = Math.min(delta, 360 - delta);
  if (distance <= 40) return .7;
  if (distance >= 150) return .25;
  return first.bright && second.bright ? -.8 : .1;
}
