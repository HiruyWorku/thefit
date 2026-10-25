import { colorCompatibility, profileGarment } from './garment-profile.mjs';

export const OUTFIT_OCCASIONS = [
  { id: 'everyday', label: 'Everyday', description: 'Relaxed pieces with a consistent style for day-to-day plans.' },
  { id: 'smart', label: 'Smart casual', description: 'Collared tops or simple knitwear, refined full-length bottoms, and smart shoes. Weather layers are added when needed.' },
  { id: 'active', label: 'Active / workout', description: 'Easy-moving tops, athletic bottoms, and training shoes. Missing sportswear is called out below.' },
];

const SLOTS = { hat: 'Hat', top: 'Top', jacket: 'Jacket', bottoms: 'Bottoms', shoes: 'Shoes' };
const ROLE_ORDER = ['hat', 'top', 'jacket', 'bottoms', 'shoes'];
const BEAM_WIDTH = 96;
const PER_SLOT_LIMIT = 24;
const QUALITY_WINDOW = 4;
const MAX_ALTERNATIVES = 12;
const hash = text => [...text].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 0);
const signature = profiles => profiles.map(profile => profile.item.id).sort().join('|');
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

function conditions(weather) {
  const current = finite(weather?.feelsLike, weather?.temperature);
  if (!Number.isFinite(current)) return null;
  const forecast = Array.isArray(weather.forecast) ? weather.forecast.slice(0, 3) : [];
  const temperatures = forecast.map(hour => hour?.feelsLike).filter(Number.isFinite);
  const chances = forecast.map(hour => hour?.rainChance).filter(Number.isFinite);
  const rainChance = Math.max(0, Math.min(100, chances.length ? Math.max(...chances) : finite(weather.rainChance, 0)));
  // Current feels-like already includes wind chill. Wind only affects shell
  // choice here; don't subtract a second wind-chill adjustment.
  const cool = Math.min(current, ...temperatures);
  const warm = Math.max(current, ...temperatures);
  const wet = finite(weather.precipitation, 0) > 0 || rainChance >= 50;
  return {
    current, cool, warm, wet, rainChance, windy: finite(weather.windSpeed, 0) >= 25,
    isDay: weather.isDay, forecastUsed: temperatures.length > 0,
    needsJacket: cool < 18 || wet || (finite(weather.windSpeed, 0) >= 25 && cool < 23),
    requiresJacket: cool < 15 || wet || (finite(weather.windSpeed, 0) >= 25 && cool < 18),
    targetWarmth: cool >= 25 ? .7 : cool >= 20 ? 1.2 : cool >= 15 ? 2.2 : cool >= 10 ? 3 : cool >= 5 ? 4 : cool >= 0 ? 5.2 : 6,
  };
}

function suitable(profile, context, occasion) {
  if (occasion === 'smart' && !profile.smartSuitable) return false;
  if (occasion === 'active' && !profile.activeSuitable) return false;
  if (profile.garmentType === 'rain-boots' && !context.wet) return false;
  if (profile.role === 'bottoms' && profile.shortBottom && context.cool < 14) return false;
  if (profile.role === 'shoes' && profile.openShoe && (context.cool < 14 || context.wet)) return false;
  if (profile.role === 'top' && profile.warmth > 2 && context.cool >= 25) return false;
  if (profile.role === 'jacket' && context.cool >= 22 && profile.warmth >= 2.5) return false;
  if (profile.role === 'hat') {
    if (context.cool <= 8) return profile.warmth >= 1.5;
    if (context.warm >= 25 && context.isDay !== false) return profile.warmth < 1.5;
    return false;
  }
  return true;
}

function itemScore(profile, context, occasion) {
  let score = 0;
  if (profile.role === 'top') {
    if (context.cool >= 25) score += profile.shortSleeve ? 5 : 0;
    else if (context.cool < 15) score += Math.min(profile.warmth, 2.4);
  } else if (profile.role === 'jacket') {
    if (context.wet) score += profile.rainProtection * 4;
    if (context.windy && profile.shell) score += 2;
    if (context.warm >= 24 && profile.warmth > 2.5) score -= 5;
    if (occasion === 'smart') score += profile.formality * 2 + (profile.color?.neutral ? 1 : 0) - (profile.sporty ? 2 : 0);
  } else if (profile.role === 'bottoms') {
    score += context.cool >= 25 ? (profile.shortBottom ? 7 : -1)
      : context.cool >= 20 ? (profile.shortBottom ? 2 : 1) : profile.shortBottom ? -3 : 3;
  } else if (profile.role === 'shoes') {
    if (context.wet) score += profile.rainProtection * 5 - (profile.mesh ? 3 : 0);
    else if (context.cool < 8) score += profile.warmth * 2;
    else score += context.cool >= 20 && profile.garmentType === 'boots' ? -2 : 1;
  } else if (profile.role === 'hat') score += 2;
  if (['top', 'bottoms', 'shoes'].includes(profile.role)) {
    const target = occasion === 'smart' ? 1.6 : occasion === 'active' ? -1 : .6;
    score -= Math.abs(profile.formality - target) * (occasion === 'everyday' ? 1 : 3);
  }
  return score;
}

function outfitScore(profiles, context, occasion) {
  let score = profiles.reduce((total, profile) => total + itemScore(profile, context, occasion), 0);
  const upper = profiles.filter(profile => profile.role === 'top' || profile.role === 'jacket');
  const warmth = upper.reduce((sum, profile) => sum + profile.warmth, 0);
  if (upper.length) {
    const difference = warmth - context.targetWarmth;
    score -= Math.abs(difference) * (difference < 0 ? 8 : 5);
  }
  const styled = profiles.filter(profile => ['top', 'bottoms', 'shoes'].includes(profile.role));
  if (!context.wet && profiles.some(profile => profile.shortBottom)
    && profiles.some(profile => profile.role === 'shoes' && profile.garmentType === 'boots')) score -= 4;
  for (let first = 0; first < profiles.length; first++) {
    for (let second = first + 1; second < profiles.length; second++) {
      score += colorCompatibility(profiles[first].color, profiles[second].color);
    }
  }
  for (let first = 0; first < styled.length; first++) {
    for (let second = first + 1; second < styled.length; second++) {
      score -= Math.abs(styled[first].formality - styled[second].formality) * 1.5;
    }
  }
  score -= Math.max(0, profiles.filter(profile => profile.color?.bright).length - 1) * 2;
  score -= Math.max(0, profiles.filter(profile => profile.patterned && profile.role !== 'shoes').length - 1) * 2;
  return score;
}

// Build a small set of high-quality, meaningfully different alternatives. A
// shuffle can change several pieces, but never relax the temperature/role rules.
function alternatives(ranked, date) {
  const best = ranked[0].score;
  const eligible = ranked.filter(candidate => candidate.score >= best - QUALITY_WINDOW);
  const tieOrder = (a, b) => hash(date + a.key) - hash(date + b.key) || a.key.localeCompare(b.key);
  const tied = eligible.filter(candidate => candidate.score >= best - .15).sort(tieOrder);
  const selected = [tied[0]];
  const remaining = eligible.filter(candidate => candidate.key !== selected[0].key);
  while (remaining.length && selected.length < MAX_ALTERNATIVES) {
    let bestIndex = 0, bestValue = -Infinity;
    for (const [index, candidate] of remaining.entries()) {
      const distance = Math.min(...selected.map(previous => {
        const ids = new Set(previous.profiles.map(profile => profile.item.id));
        return candidate.profiles.filter(profile => !ids.has(profile.item.id)).length;
      }));
      const value = distance * 2 + (candidate.score - best) * .35;
      if (value > bestValue || (value === bestValue && tieOrder(candidate, remaining[bestIndex]) < 0)) {
        bestValue = value; bestIndex = index;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  return selected;
}

function reasonFor(profile, profiles, context, occasion) {
  if (occasion === 'smart' && profile.role === 'top') return ['sweater', 'cardigan'].includes(profile.garmentType) ? 'Simple knitwear for a smart casual base.' : 'A collared or dressier top for smart casual.';
  if (occasion === 'smart' && profile.role === 'bottoms') return 'Refined full-length bottoms to keep the look smart casual.';
  if (occasion === 'smart' && profile.role === 'shoes' && !context.wet) return 'Dress shoes or minimal sneakers to finish the smart casual look.';
  if (profile.role === 'top') return context.cool >= 25 ? 'A lighter base for the heat.'
    : profile.warmth >= 2 ? 'A warm base balanced with the outer layer.'
      : context.cool < 15 ? 'A light base; the jacket supplies most of the warmth.' : 'A base layer that works with the rest of the look.';
  if (profile.role === 'jacket') return context.wet && profile.rainProtection >= 2
    ? 'A rain layer, balanced with the top underneath.'
    : profile.puffer ? 'Insulation for the colder feels-like temperature.'
      : context.windy && profile.shell ? 'A shell layer for windy conditions.' : 'One outer layer for the cooler weather.';
  if (profile.role === 'bottoms') return profile.shortBottom ? 'Lighter coverage for warmer conditions.' : 'Full-length coverage that suits the temperature.';
  if (profile.role === 'hat') return profile.warmth >= 1.5 ? 'Warm headwear for the cold.' : 'Light headwear for a hot day.';
  if (context.wet) return profile.waterproof ? 'Tagged waterproof for wet conditions.'
    : profile.mesh ? 'The closest available shoes; rain protection is limited.' : 'Closed footwear is the better available rain option.';
  const bottoms = profiles.find(candidate => candidate.role === 'bottoms');
  return bottoms?.formality >= 1.5 && profile.formality >= .8
    ? 'Works with the tailored bottoms better than running shoes.' : 'Matches the formality of the rest of the look.';
}

export function suggestOutfit(items, weather, variation = 0, options = {}) {
  const context = conditions(weather);
  const empty = { chosen: [], missing: [], warnings: [], corrections: [], alternativeCount: 0, hasAlternatives: false, forecastUsed: false };
  if (!context) return { ...empty, summary: 'Weather is unavailable. Refresh it before choosing a look.' };
  const occasion = OUTFIT_OCCASIONS.some(value => value.id === options?.occasion) ? options.occasion : 'everyday';
  const unique = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const profile = profileGarment(item);
    if (profile && !unique.has(item.id)) unique.set(item.id, profile);
  }
  const profiles = [...unique.values()].sort((a, b) => a.item.id.localeCompare(b.item.id));
  const roles = ROLE_ORDER.filter(role => role !== 'jacket' || context.needsJacket);
  const missing = [], pools = [];
  for (const role of roles) {
    const candidates = profiles.filter(profile => profile.role === role && suitable(profile, context, occasion))
      .sort((a, b) => itemScore(b, context, occasion) - itemScore(a, context, occasion) || a.item.id.localeCompare(b.item.id))
      .slice(0, PER_SLOT_LIMIT);
    const required = role !== 'hat' && (role !== 'jacket' || context.requiresJacket);
    if (!candidates.length && required) missing.push(SLOTS[role]);
    pools.push(required && candidates.length ? candidates : [null, ...candidates]);
  }
  let beam = [{ profiles: [], key: '', score: 0 }];
  for (const pool of pools) {
    const next = [];
    for (const partial of beam) for (const candidate of pool) {
      const combination = candidate ? [...partial.profiles, candidate] : partial.profiles;
      next.push({ profiles: combination, key: signature(combination), score: outfitScore(combination, context, occasion) });
    }
    beam = next.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)).slice(0, BEAM_WIDTH);
  }
  const looks = alternatives(beam, typeof weather.date === 'string' ? weather.date : '');
  const step = Number.isFinite(variation) ? Math.max(0, Math.floor(variation)) : 0;
  const selected = looks[step % looks.length].profiles;
  const warnings = [];
  const top = selected.find(profile => profile.role === 'top');
  const jacket = selected.find(profile => profile.role === 'jacket');
  const shoes = selected.find(profile => profile.role === 'shoes');
  if (missing.length) warnings.push('No suitable ' + missing.join(', ').toLowerCase() + (occasion === 'smart' ? ' for smart casual in this weather.' : occasion === 'active' ? ' for active plans in this weather.' : ' available for these conditions.') + ' Showing only pieces you own.');
  if (context.cool < 10 && top && top.warmth < 1.5) warnings.push('No warm top in this look. A sweater or long-sleeve thermal would improve cold-weather coverage.');
  if (context.cool < 15 && top && top.warmth + (jacket?.warmth || 0) < context.targetWarmth - .8) warnings.push('The available layers may be too light for these cold conditions.');
  if (context.wet && jacket && jacket.rainProtection < 2) warnings.push('The jacket prioritizes warmth and is not tagged for rain protection.');
  if (context.wet && shoes && shoes.rainProtection < 2) warnings.push('Your selected shoes are not tagged waterproof; rain protection is limited.');
  const corrections = profiles.filter(profile => profile.categoryCorrected).map(profile => ({
    itemId: profile.item.id, name: profile.item.name || 'Unnamed item', detectedRole: SLOTS[profile.role],
    message: (profile.item.name || 'This item') + ' is treated as ' + SLOTS[profile.role].toLowerCase() + ' based on its name/details, rather than its saved category.',
  }));
  const summary = (context.cool >= 25 ? 'Light pieces for the heat.' : context.cool < 10 ? 'Cold conditions call for a warm top, one outer layer, and full-length bottoms.'
    : context.cool < 18 ? 'Balanced layers for cooler weather.' : 'Comfortable pieces for mild weather.')
    + (context.wet ? ' Rain protection matters for this look.' : '')
    + (context.forecastUsed ? ' Matched to now and the next few hours.' : '');
  return {
    chosen: selected.map(profile => ({ slot: SLOTS[profile.role], item: profile.item, reason: reasonFor(profile, selected, context, occasion) })),
    missing, warnings, corrections, summary, alternativeCount: selected.length ? looks.length : 0, hasAlternatives: selected.length > 0 && looks.length > 1,
    forecastUsed: context.forecastUsed, occasion,
  };
}
