import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { suggestOutfit } from '../src/daily-outfit.mjs';
import { profileGarment, colorCompatibility, colorProfile } from '../src/garment-profile.mjs';
const item = (id, part, name) => ({ id, part, name, tags: [], image: `/${id}.png` });
const items = [item('hat','accessories_up','Sun hat'), item('tee','upperbody','Cotton T-shirt'), item('sweater','upperbody','Wool sweater'), item('shorts','lowerbody','Shorts'), item('pants','lowerbody','Jeans'), item('sneakers','shoes','Sneakers'), item('boots','shoes','Waterproof boots'), item('raincoat','wholebody_up','Waterproof rain shell'), item('bag','accessories_up','Bag')];
const weather = { feelsLike: 29, rainChance: 0, precipitation: 0, date: '2026-10-24' };
test('hot outfit is ordered hat, T-shirt, shorts, sneakers', () => {
 assert.deepEqual(suggestOutfit(items, weather).chosen.map(x=>x.item.id), ['hat','tee','shorts','sneakers']);
});
test('cold rain favors warm pieces, rain layer and boots', () => {
 assert.deepEqual(suggestOutfit(items,{...weather,feelsLike:8,rainChance:80}).chosen.map(x=>x.item.id), ['sweater','raincoat','pants','boots']);
});

test('the bundled 41-piece wardrobe respects garment and weather constraints across 576 looks', async () => {
 const wardrobe=JSON.parse(await readFile(new URL('../sample-wardrobe/library.json',import.meta.url),'utf8'));
 const ids=new Set(wardrobe.map(entry=>entry.id));
 for(const feelsLike of [-5,0,8,14,18,22,27,32]) for(const rainChance of [0,90]) {
  for(const occasion of ['everyday','smart','active']) for(let variation=0;variation<12;variation++) {
   const look=suggestOutfit(wardrobe,{...weather,feelsLike,rainChance},variation,{occasion});
   const profiles=look.chosen.map(entry=>profileGarment(entry.item));
   assert.equal(profiles.filter(entry=>entry.role==='top').length,1);
   assert.ok(profiles.filter(entry=>entry.role==='jacket').length<=1);
   assert.equal(new Set(look.chosen.map(entry=>entry.item.id)).size,look.chosen.length);
   assert.ok(look.chosen.every(entry=>ids.has(entry.item.id)));
   if(feelsLike<14) assert.ok(!profiles.some(entry=>entry.shortBottom||entry.openShoe));
   if(feelsLike>=25) assert.ok(!profiles.some(entry=>entry.role==='top'&&entry.warmth>2));
   if(feelsLike>=22) assert.ok(!profiles.some(entry=>entry.role==='jacket'&&entry.warmth>=2.5));
  }
 }
});

const selected = (look, slot) => look.chosen.find(entry => entry.slot === slot)?.item;
const withColor = (entry, color) => ({ ...entry, color });
const cold = { ...weather, feelsLike: 8 };
const mild = { ...weather, feelsLike: 20 };

test('regression: a puffer mislabeled as a top never creates a two-jacket outfit', () => {
 const wardrobe = [...items, item('puffer', 'upperbody', 'Puffer jacket')];
 for (let variation = 0; variation < 20; variation++) {
   const look = suggestOutfit(wardrobe, cold, variation);
   assert.equal(profileGarment(selected(look, 'Top')).role, 'top');
   assert.ok(look.chosen.filter(entry => profileGarment(entry.item).role === 'jacket').length <= 1);
   assert.ok(look.corrections.some(entry => entry.itemId === 'puffer' && entry.detectedRole === 'Jacket'));
 }
});

test('jackets cannot replace a missing base top, even if every jacket is mislabeled', () => {
 const look = suggestOutfit([item('puffer','upperbody','Puffer jacket'), item('rain','upperbody','Blue Rainjacket'), items[4], items[5]], cold);
 assert.equal(selected(look, 'Top'), undefined);
 assert.ok(look.missing.includes('Top'));
 assert.equal(look.chosen.filter(entry => entry.slot === 'Jacket').length, 1);
});

test('semantic role evidence also handles wrongly categorized shirts, pants and shoes', () => {
 assert.equal(profileGarment(item('polo','wholebody_up','Navy polo')).role, 'top');
 assert.equal(profileGarment(item('shoes','upperbody','Low-top sneakers')).role, 'shoes');
 assert.equal(profileGarment(item('pants','upperbody','Black tailored pants')).role, 'bottoms');
 assert.equal(profileGarment({...item('anonymous','upperbody','My piece'),tags:['puffer jacket']}).role, 'jacket');
 assert.equal(profileGarment(item('bag','accessories_up','Canvas bag')), null);
 assert.equal(profileGarment(item('tee','wholebody_up','Cotton T‑shirt')).role,'top');
});

test('a dry cold day selects insulated outerwear over a thin rain shell', () => {
 const wardrobe = [items[1], items[4], items[5], items[7], item('puffer','wholebody_up','Winter puffer jacket')];
 assert.equal(selected(suggestOutfit(wardrobe,cold),'Jacket').id, 'puffer');
});

test('warmth is balanced across the top and jacket together', () => {
 const wardrobe = [...items, item('puffer','wholebody_up','Winter puffer jacket')];
 const look = suggestOutfit(wardrobe, {...cold, rainChance:90});
 assert.equal(selected(look,'Top').id, 'sweater');
 assert.equal(selected(look,'Jacket').id, 'raincoat');
});

test('hot looks never substitute winter outerwear or heavy wool tops', () => {
 const wardrobe = [...items, item('puffer','upperbody','Winter puffer jacket')];
 for(let variation=0;variation<20;variation++) {
  const look=suggestOutfit(wardrobe,weather,variation);
  assert.equal(selected(look,'Jacket'),undefined);
  assert.equal(selected(look,'Top').id,'tee');
  assert.equal(selected(look,'Bottoms').id,'shorts');
 }
});

test('heavy winter outerwear is not used as the only available hot-weather rain layer', () => {
 const wardrobe=[items[1],items[3],items[5],item('puffer','wholebody_up','Puffer jacket')];
 const look=suggestOutfit(wardrobe,{...weather,rainChance:90});
 assert.equal(selected(look,'Jacket'),undefined);
 assert.ok(look.missing.includes('Jacket'));
});

test('cold wardrobes containing only shorts report a gap instead of forcing shorts', () => {
 const look=suggestOutfit([items[1],items[3],items[5]],{...cold,feelsLike:0});
 assert.equal(selected(look,'Bottoms'),undefined);
 assert.ok(look.missing.includes('Bottoms'));
});

test('open shoes are excluded in cold or wet conditions', () => {
 const sandals=item('sandals','shoes','Summer sandals');
 assert.equal(selected(suggestOutfit([sandals],cold),'Shoes'),undefined);
 assert.equal(selected(suggestOutfit([sandals],{...mild,rainChance:85}),'Shoes'),undefined);
});

test('rain favors labeled waterproof boots over mesh running shoes', () => {
 const mesh=item('mesh','shoes','Knit mesh running shoes');
 const look=suggestOutfit([...items,mesh],{...mild,rainChance:85});
 assert.equal(selected(look,'Shoes').id,'boots');
});

test('unverified leather shoes never acquire invented waterproof properties', () => {
 const leather=item('leather','shoes','Black leather sneakers');
 const look=suggestOutfit([items[1],items[4],items[7],leather],{...mild,rainChance:85});
 assert.ok(look.warnings.some(note=>note.includes('not tagged waterproof')));
 assert.equal(profileGarment({...leather,tags:['not waterproof']}).waterproof,false);
});

test('a colder near-term forecast adds a layer without using the overnight daily low', () => {
 const forecast={...mild,feelsLike:22,low:0,forecast:[{feelsLike:10,rainChance:0}]};
 assert.ok(selected(suggestOutfit(items,forecast),'Jacket'));
 assert.equal(selected(suggestOutfit(items,{...mild,low:0}),'Jacket'),undefined);
});

test('near-term rain supersedes an all-day rain chance from hours ago', () => {
 const look=suggestOutfit(items,{...mild,rainChance:95,forecast:[{feelsLike:20,rainChance:0},{feelsLike:21,rainChance:5}]});
 assert.equal(selected(look,'Jacket'),undefined);
 const raining=suggestOutfit(items,{...mild,precipitation:1,forecast:[{feelsLike:20,rainChance:0}]});
 assert.equal(selected(raining,'Jacket').id,'raincoat');
});

test('wind can justify a shell in mild conditions without double-counting feels-like', () => {
 const look=suggestOutfit(items,{...mild,windSpeed:35});
 assert.equal(selected(look,'Jacket').id,'raincoat');
});

test('summer hats are not recommended for cold days and winter hats are not used for heat', () => {
 const wardrobe=[...items,item('beanie','accessories_up','Wool winter beanie')];
 assert.equal(selected(suggestOutfit(wardrobe,cold),'Hat').id,'beanie');
 assert.equal(selected(suggestOutfit(wardrobe,weather),'Hat').id,'hat');
 assert.equal(selected(suggestOutfit(wardrobe,{...weather,isDay:false}),'Hat'),undefined);
});

test('whole-look style compatibility pairs tailored trousers with leather sneakers', () => {
 const wardrobe=[item('polo','upperbody','Navy polo'),item('tailored','lowerbody','Tailored trousers'),
  item('running','shoes','Athletic running shoes'),item('leather','shoes','Black leather sneakers')];
 assert.equal(selected(suggestOutfit(wardrobe,mild),'Shoes').id,'leather');
});

test('occasion preference changes complete combinations rather than just one item', () => {
 const wardrobe=[item('polo','upperbody','Navy polo'),item('tee','upperbody','Graphic T-shirt'),
  item('tailored','lowerbody','Tailored trousers'),item('sportshorts','lowerbody','Athletic shorts'),
  item('running','shoes','Athletic running shoes'),item('leather','shoes','Black leather sneakers')];
 const smart=suggestOutfit(wardrobe,mild,0,{occasion:'smart'});
 const active=suggestOutfit(wardrobe,mild,0,{occasion:'active'});
 assert.equal(selected(smart,'Top').id,'polo');
 assert.equal(selected(smart,'Bottoms').id,'tailored');
 assert.equal(selected(smart,'Shoes').id,'leather');
 assert.equal(selected(active,'Top').id,'tee');
 assert.equal(selected(active,'Bottoms').id,'sportshorts');
 assert.equal(selected(active,'Shoes').id,'running');
});

test('color compatibility softly favors a neutral anchor over multiple competing accents', () => {
 assert.ok(colorCompatibility(colorProfile('#e82626'),colorProfile('#252525'))>
  colorCompatibility(colorProfile('#e82626'),colorProfile('#29e626')));
 assert.equal(colorProfile('unknown'),null);
 assert.equal(colorCompatibility(null,colorProfile('#ffffff')),0);
});

test('shuffling is deterministic, cycles good alternatives, and never changes garment constraints', () => {
 const wardrobe=[...items,item('tee2','upperbody','Cotton T-shirt'),item('shorts2','lowerbody','Shorts')];
 const first=suggestOutfit(wardrobe,weather);
 assert.ok(first.hasAlternatives);
 const variants=new Set();
 for(let index=0;index<first.alternativeCount;index++) {
  const look=suggestOutfit(wardrobe,weather,index);
  const ids=look.chosen.map(entry=>entry.item.id);
  assert.equal(ids.length,new Set(ids).size);
  assert.ok(!look.chosen.some(entry=>entry.slot==='Jacket'));
  variants.add(ids.join('|'));
 }
 assert.equal(variants.size,first.alternativeCount);
 assert.deepEqual(suggestOutfit([...wardrobe].reverse(),weather),first);
 assert.deepEqual(suggestOutfit(wardrobe,weather,first.alternativeCount),first);
});

test('one valid look does not pretend there are alternatives', () => {
 const look=suggestOutfit([items[1],items[3],items[5]],weather);
 assert.equal(look.alternativeCount,1);
 assert.equal(look.hasAlternatives,false);
});

test('smart casual never fills gaps with hoodies, athletic shorts, or running shoes', () => {
 const wardrobe=[item('hoodie','upperbody','Hoodie'),item('shorts','lowerbody','Athletic shorts'),item('runners','shoes','Running shoes')];
 for(let variation=0;variation<12;variation++) {
  const look=suggestOutfit(wardrobe,mild,variation,{occasion:'smart'});
  assert.equal(look.chosen.length,0);
  assert.deepEqual(look.missing,['Top','Bottoms','Shoes']);
  assert.ok(look.warnings.some(note=>note.includes('smart casual')));
 }
});

test('smart casual alternatives keep shirts or plain knitwear with refined bottoms and shoes', () => {
 const wardrobe=[item('shirt','upperbody','Button-up shirt'),item('knit','upperbody','Grey sweater'),
  item('hoodie','upperbody','Hoodie'),item('sweatshirt','upperbody','Sweatshirt'),
  item('chinos','lowerbody','Chinos'),item('darkjeans','lowerbody','Dark indigo jeans'),item('ripped','lowerbody','Distressed jeans'),
  item('loafers','shoes','Leather loafers'),item('clean','shoes','Minimal leather sneakers'),item('work','shoes','Work boots'),item('runners','shoes','Running shoes')];
 for(let variation=0;variation<12;variation++) {
  const look=suggestOutfit(wardrobe,mild,variation,{occasion:'smart'});
  assert.equal(look.chosen.length,3);
  assert.ok(['shirt','knit'].includes(selected(look,'Top').id));
  assert.ok(['chinos','darkjeans'].includes(selected(look,'Bottoms').id));
  assert.ok(['loafers','clean'].includes(selected(look,'Shoes').id));
 }
});

test('active plans report gaps instead of dressing workout looks in tailored clothes or work boots', () => {
 const wardrobe=[item('shirt','upperbody','Button-up shirt'),item('pants','lowerbody','Tailored trousers'),item('boots','shoes','Work boots')];
 const look=suggestOutfit(wardrobe,mild,0,{occasion:'active'});
 assert.equal(look.chosen.length,0);
 assert.ok(look.warnings.some(note=>note.includes('active plans')));
});

test('all smart casual and active alternatives in the sample wardrobe meet their occasion rules', async () => {
 const wardrobe=JSON.parse(await readFile(new URL('../sample-wardrobe/library.json',import.meta.url),'utf8'));
 for(const occasion of ['smart','active']) for(const feelsLike of [8,20,29]) for(let variation=0;variation<12;variation++) {
  const look=suggestOutfit(wardrobe,{...weather,feelsLike},variation,{occasion});
  assert.ok(look.chosen.every(({item})=>profileGarment(item)[occasion==='smart'?'smartSuitable':'activeSuitable']));
 }
});

test('dry warm everyday alternatives do not pair shorts with rain or work boots', async () => {
 const wardrobe=JSON.parse(await readFile(new URL('../sample-wardrobe/library.json',import.meta.url),'utf8'));
 for(let variation=0;variation<12;variation++) {
  const look=suggestOutfit(wardrobe,mild,variation);
  const profiles=look.chosen.map(({item})=>profileGarment(item));
  assert.ok(!profiles.some(profile=>profile.garmentType==='rain-boots'));
  if(profiles.some(profile=>profile.shortBottom)) assert.ok(!profiles.some(profile=>profile.garmentType==='boots'));
 }
});

test('bad metadata, duplicated IDs and malformed optional values do not crash selection', () => {
 const wardrobe=[null,{}, {...items[1],tags:[null,5,{}],color:'not a color'},items[1],items[3],items[5]];
 const look=suggestOutfit(wardrobe,weather,NaN);
 assert.equal(look.chosen.length,3);
 assert.equal(new Set(look.chosen.map(entry=>entry.item.id)).size,3);
 assert.ok(look.chosen.every(entry=>typeof entry.reason==='string'&&entry.reason.length>0));
 assert.deepEqual(suggestOutfit([],null).chosen,[]);
 assert.equal(suggestOutfit([],null).hasAlternatives,false);
});
test('missing categories are reported and nonexistent items are never suggested', () => {
 const result=suggestOutfit([items[1]],weather);
 assert.deepEqual(result.chosen.map(x=>x.item.id),['tee']);
 assert.deepEqual(result.missing,['Bottoms','Shoes']);
 assert.equal(suggestOutfit([],weather).chosen.length,0);
 assert.equal(suggestOutfit([],weather).alternativeCount,0);
});
test('user details identify pieces and updates immediately affect recommendations', () => {
 const renamed={...items[2], name:'My top',tags:['t-shirt']};
 assert.equal(suggestOutfit([renamed],weather).chosen[0].item.id,'sweater');
 const choices=[items[1],{...items[1],id:'tee2'}];
 assert.notEqual(suggestOutfit(choices,weather,0).chosen[0].item.id,suggestOutfit(choices,weather,1).chosen[0].item.id);
 assert.deepEqual(suggestOutfit(items,weather),suggestOutfit(items,weather));
});
