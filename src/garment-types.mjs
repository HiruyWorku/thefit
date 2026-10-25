// Shared by the gallery, forms, API and outfit engine. Keep legacy category IDs
// readable; precise garment types can be added without breaking saved wardrobes.
export const CATEGORIES = [
  { id: 'upperbody', label: 'Tops', singular: 'Top', role: 'top' },
  { id: 'wholebody_up', label: 'Outerwear', singular: 'Outer layer', role: 'jacket' },
  { id: 'lowerbody', label: 'Bottoms', singular: 'Bottom', role: 'bottoms' },
  { id: 'shoes', label: 'Footwear', singular: 'Footwear', role: 'shoes' },
  { id: 'headwear', label: 'Headwear', singular: 'Hat', role: 'hat' },
  { id: 'accessories_up', label: 'Accessories', singular: 'Accessory', role: 'accessory' },
];
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(category => [category.id, category]));
const groups = [
  ['shoes', [
    ['rain-boots', 'Rain boots', /\b(rain boots?|rubber boots?|wellies|wellingtons)\b/],
    ['running-shoes', 'Running & training shoes', /\b(running|athletic|training|gym) (shoes?|sneakers?|trainers?)\b/],
    ['loafers', 'Loafers', /\bloafers?\b/],
    ['dress-shoes', 'Dress shoes', /\b(dress shoes?|oxfords?|derby|derbies|brogues?)\b/],
    ['boots', 'Boots', /\bboots?\b/],
    ['sandals', 'Sandals & slides', /\b(sandals?|slides?|flip flops?)\b/],
    ['sneakers', 'Sneakers', /\b(sneakers?|trainers?|tennis shoes?)\b/],
    ['other-footwear', 'Other footwear'],
  ]],
  ['headwear', [
    ['beanie', 'Beanie', /\b(beanies?|wool hats?|winter hats?)\b/],
    ['cap', 'Baseball & trucker cap', /\b(caps?|baseball|trucker)\b/],
    ['sun-hat', 'Sun hat', /\b(sun hats?|bucket hats?|straw hats?)\b/],
    ['other-headwear', 'Other headwear', /\b(hats?|berets?|fedoras?)\b/],
  ]],
  ['accessories_up', [
    ['bag', 'Bag', /\b(bags?|backpacks?|totes?)\b/],
    ['belt', 'Belt', /\bbelts?\b/],
    ['scarf', 'Scarf', /\b(scarf|scarves)\b/],
    ['gloves', 'Gloves', /\b(gloves?|mittens?)\b/],
    ['other-accessory', 'Other accessory'],
  ]],
  ['wholebody_up', [
    ['puffer-jacket', 'Puffer jacket', /\b(puffers?|parkas?|down jackets?|insulated jackets?)\b/],
    ['rain-jacket', 'Rain jacket / shell', /\b(rain\s?jackets?|rain\s?coats?|rain shell|shell jackets?|hooded shell)\b/],
    ['windbreaker', 'Windbreaker', /\bwindbreakers?\b/],
    ['fleece-jacket', 'Fleece jacket', /\bfleece (jackets?|zip|layers?)\b/],
    ['leather-jacket', 'Leather jacket', /\b(leather|biker) jackets?\b/],
    ['blazer', 'Blazer', /\b(blazers?|suit jackets?)\b/],
    ['coat', 'Coat', /\b(coats?|overcoats?|trench)\b/],
    ['other-jacket', 'Other jacket', /\b(jackets?|shackets?|overshirts?|outerwear)\b/],
  ]],
  ['lowerbody', [
    ['jeans', 'Jeans', /\bjeans\b/],
    ['shorts', 'Shorts', /\bshorts\b/],
    ['joggers', 'Joggers & sweatpants', /\b(joggers?|sweatpants)\b/],
    ['chinos', 'Chinos', /\bchinos\b/],
    ['leggings', 'Leggings', /\bleggings\b/],
    ['skirt', 'Skirt', /\bskirts?\b/],
    ['trousers', 'Trousers', /\b(trousers?|pants)\b/],
    ['other-bottoms', 'Other bottoms'],
  ]],
  ['upperbody', [
    ['long-sleeve-top', 'Long-sleeve top', /\blong sleeve (tops?|t shirts?|tees?)\b/],
    ['t-shirt', 'T-shirt', /\b(t shirts?|tshirts?|tees?)\b/],
    ['polo', 'Polo shirt', /\bpolos?\b/],
    ['hoodie', 'Hoodie', /\bhoodies?\b/],
    ['sweatshirt', 'Sweatshirt', /\bsweatshirts?\b/],
    ['cardigan', 'Cardigan', /\bcardigans?\b/],
    ['sweater', 'Sweater', /\b(sweaters?|pullovers?)\b/],
    ['thermal', 'Thermal top', /\bthermals?\b/],
    ['tank-top', 'Tank top', /\btanks?\b/],
    ['blouse', 'Blouse', /\bblouses?\b/],
    ['shirt', 'Button-up shirt', /\b(shirts?|button up|button down)\b/],
    ['other-top', 'Other top', /\btops?\b/],
  ]],
];
export const GARMENT_TYPES = groups.flatMap(([part, types]) => types.map(([id, label, pattern]) => ({ id, label, part, role: CATEGORY_MAP[part].role, pattern })));
export const GARMENT_TYPE_MAP = Object.fromEntries(GARMENT_TYPES.map(type => [type.id, type]));
const normalize = value => typeof value === 'string' ? value.toLowerCase().replace(/[-_\u2010-\u2015]/g, ' ').replace(/\s+/g, ' ').trim() : '';
export function getGarmentType(item) {
  if (!item) return null;
  // A user's explicit choice wins over inferred text, including a vague name.
  if (Object.hasOwn(GARMENT_TYPE_MAP, item.garmentType)) return GARMENT_TYPE_MAP[item.garmentType];
  const texts = [normalize(item.name), normalize(Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === 'string').join(' ') : '')];
  for (const text of texts) {
    const type = GARMENT_TYPES.find(candidate => candidate.pattern?.test(text));
    if (type) return type;
  }
  return GARMENT_TYPES.find(type => type.part === item.part && type.id.startsWith('other-')) || null;
}
export const getItemCategory = item => getGarmentType(item)?.part || item?.part || '';
export const validGarmentType = (part, type) => type === null || type === undefined || type === ''
  || (typeof type === 'string' && Object.hasOwn(GARMENT_TYPE_MAP, type) && GARMENT_TYPE_MAP[type].part === part);

export function filterWardrobe(items, part = 'all', garmentType = 'all') {
  return items.filter(item => (part === 'all' || getItemCategory(item) === part)
    && (garmentType === 'all' || getGarmentType(item)?.id === garmentType));
}
