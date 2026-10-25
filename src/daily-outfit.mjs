const matches = (item, pattern) => pattern.test(`${item.name || ''} ${(item.tags || []).join(' ')}`);
const hotTop = /\b(t[ -]?shirts?|tees?|tank|polo|short[ -]sleeve|linen)\b/i;
const warmTop = /\b(sweater|sweatshirt|hoodie|fleece|thermal|wool|long[ -]sleeve)\b/i;
const shorts = /\bshorts\b/i;
const warmBottom = /\b(jeans|trousers|pants|chinos|leggings)\b/i;
const rainwear = /\b(rain|waterproof|water[ -]resistant|shell)\b/i;
const headwear = /\b(hat|cap|beanie|fedora|beret)\b/i;
const hash = text => [...text].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 0);

export function suggestOutfit(items, weather, variation = 0) {
  const hot = weather.feelsLike >= 25;
  const cold = weather.feelsLike < 15;
  const wet = weather.rainChance >= 50 || weather.precipitation > 0;
  const chosen = [];
  const missing = [];
  const pick = (slot, candidates, score, required = true) => {
    if (!candidates.length) { if (required) missing.push(slot); return; }
    const ranked = candidates.map(item => ({ item, score: score(item) }));
    const best = Math.max(...ranked.map(entry => entry.score));
    const pool = ranked.filter(entry => entry.score === best).map(entry => entry.item).sort((a, b) => a.id.localeCompare(b.id));
    chosen.push({ slot, item: pool[(hash(`${weather.date}:${slot}`) + variation) % pool.length] });
  };
  pick('Hat', items.filter(i => i.part === 'accessories_up' && matches(i, headwear)), i => cold ? Number(matches(i, /\b(beanie|wool|winter)\b/i)) : Number(matches(i, /\b(cap|sun|bucket)\b/i)), false);
  pick('Top', items.filter(i => i.part === 'upperbody'), i => hot ? Number(matches(i, hotTop)) * 3 - Number(matches(i, warmTop)) * 3 : cold ? Number(matches(i, warmTop)) * 3 : Number(!matches(i, warmTop)));
  if (cold || wet) pick('Jacket', items.filter(i => i.part === 'wholebody_up'), i => (wet ? Number(matches(i, rainwear)) * 4 : 0) + (cold ? Number(matches(i, /\b(coat|puffer|winter|wool|fleece)\b/i)) * 2 : 0));
  pick('Bottoms', items.filter(i => i.part === 'lowerbody'), i => hot ? Number(matches(i, shorts)) * 4 : Number(matches(i, warmBottom)) * 3 - Number(matches(i, shorts)) * 3);
  pick('Shoes', items.filter(i => i.part === 'shoes'), i => wet ? Number(matches(i, /\b(boots?|waterproof)\b/i)) * 4 - Number(matches(i, /\b(sandals?|slides?)\b/i)) * 3 : Number(matches(i, /\b(sneakers?|trainers?|tennis)\b/i)) * 2);
  return { chosen, missing, summary: `${hot ? 'Hot weather: keep it light and breathable.' : cold ? 'Cool weather: reach for warmer pieces and a layer.' : 'Mild weather: comfortable everyday pieces.'}${wet ? ' Rain is possible today; consider a water-resistant layer.' : ''}` };
}
