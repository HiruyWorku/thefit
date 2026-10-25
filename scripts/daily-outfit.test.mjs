import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestOutfit } from '../src/daily-outfit.mjs';
const item = (id, part, name) => ({ id, part, name, tags: [], image: `/${id}.png` });
const items = [item('hat','accessories_up','Sun hat'), item('tee','upperbody','Cotton T-shirt'), item('sweater','upperbody','Wool sweater'), item('shorts','lowerbody','Shorts'), item('pants','lowerbody','Jeans'), item('sneakers','shoes','Sneakers'), item('boots','shoes','Waterproof boots'), item('raincoat','wholebody_up','Waterproof rain shell'), item('bag','accessories_up','Bag')];
const weather = { feelsLike: 29, rainChance: 0, precipitation: 0, date: '2026-10-24' };
test('hot outfit is ordered hat, T-shirt, shorts, sneakers', () => {
 assert.deepEqual(suggestOutfit(items, weather).chosen.map(x=>x.item.id), ['hat','tee','shorts','sneakers']);
});
test('cold rain favors warm pieces, rain layer and boots', () => {
 assert.deepEqual(suggestOutfit(items,{...weather,feelsLike:8,rainChance:80}).chosen.map(x=>x.item.id), ['hat','sweater','raincoat','pants','boots']);
});
test('missing categories are reported and nonexistent items are never suggested', () => {
 const result=suggestOutfit([items[1]],weather);
 assert.deepEqual(result.chosen.map(x=>x.item.id),['tee']);
 assert.deepEqual(result.missing,['Bottoms','Shoes']);
 assert.equal(suggestOutfit([],weather).chosen.length,0);
});
test('user details identify pieces and updates immediately affect recommendations', () => {
 const renamed={...items[2], name:'My top',tags:['t-shirt']};
 assert.equal(suggestOutfit([renamed],weather).chosen[0].item.id,'sweater');
 const choices=[items[1],{...items[1],id:'tee2'}];
 assert.notEqual(suggestOutfit(choices,weather,0).chosen[0].item.id,suggestOutfit(choices,weather,1).chosen[0].item.id);
 assert.deepEqual(suggestOutfit(items,weather),suggestOutfit(items,weather));
});
