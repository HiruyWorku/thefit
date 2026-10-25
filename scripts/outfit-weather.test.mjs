import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOutfitWeather, weatherParameters } from '../src/outfit-weather.mjs';

const response = () => ({
 current:{time:'2026-10-25T23:15',temperature_2m:12,apparent_temperature:10,wind_speed_10m:28,is_day:0},
 daily:{time:['2026-10-25'],temperature_2m_max:[20],temperature_2m_min:[5],precipitation_probability_max:[80]},
 hourly:{time:['2026-10-25T23:00','2026-10-26T00:00','2026-10-26T01:00','2026-10-26T02:00','2026-10-26T03:00'],
 apparent_temperature:[11,9,8,7,6],precipitation_probability:[90,0,10,20,95]},
});
test('weather parameters request a short forecast with explicit Celsius and km/h units',()=>{
 const params=weatherParameters({latitude:40.12345,longitude:-82.98765});
 assert.equal(params.get('latitude'),'40.12');
 assert.equal(params.get('longitude'),'-82.99');
 assert.equal(params.get('forecast_hours'),'6');
 assert.equal(params.get('temperature_unit'),'celsius');
 assert.equal(params.get('wind_speed_unit'),'kmh');
 assert.match(params.get('hourly'),/apparent_temperature/);
});
test('forecast uses the next three provider-local hours, including across midnight',()=>{
 const parsed=parseOutfitWeather(response());
 assert.deepEqual(parsed.forecast,[{feelsLike:9,rainChance:0},{feelsLike:8,rainChance:10},{feelsLike:7,rainChance:20}]);
 assert.equal(parsed.windSpeed,28);
 assert.equal(parsed.isDay,false);
 assert.equal(parsed.date,'2026-10-25');
});
test('missing hourly data falls back to current weather without inventing a forecast',()=>{
 const data=response();delete data.hourly;delete data.daily.precipitation_probability_max;
 const parsed=parseOutfitWeather(data);
 assert.deepEqual(parsed.forecast,[]);
 assert.equal(parsed.rainChance,null);
 assert.throws(()=>parseOutfitWeather({}),/unavailable/);
});
test('malformed optional forecast fields fall back without leaking a parser error',()=>{
 const data=response();data.hourly.time='not an array';data.current.wind_speed_10m=NaN;
 data.daily.precipitation_probability_max=['unknown'];
 const parsed=parseOutfitWeather(data);
 assert.deepEqual(parsed.forecast,[]);
 assert.equal(parsed.windSpeed,0);
 assert.equal(parsed.rainChance,null);
});
