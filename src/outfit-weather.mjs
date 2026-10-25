export function weatherParameters(coords) {
  return new URLSearchParams({
    latitude: coords.latitude.toFixed(2), longitude: coords.longitude.toFixed(2),
    current: 'temperature_2m,apparent_temperature,precipitation,wind_speed_10m,is_day',
    hourly: 'apparent_temperature,precipitation_probability',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit: 'celsius', wind_speed_unit: 'kmh', timezone: 'auto', forecast_days: '1', forecast_hours: '6',
  });
}

export function parseOutfitWeather(data) {
  if (![data?.current?.apparent_temperature, data?.current?.temperature_2m,
    data?.daily?.temperature_2m_max?.[0], data?.daily?.temperature_2m_min?.[0]].every(Number.isFinite)) {
    throw new Error('Weather is unavailable right now. Please try again.');
  }
  const currentTime = data.current.time;
  const hourlyTimes = Array.isArray(data.hourly?.time) ? data.hourly.time : [];
  const forecast = hourlyTimes.flatMap((time, index) => {
    // Compare the provider's local ISO strings, not the browser's time zone.
    if (typeof time !== 'string' || typeof currentTime !== 'string' || time < currentTime) return [];
    const feelsLike = data.hourly.apparent_temperature?.[index];
    if (!Number.isFinite(feelsLike)) return [];
    return [{ feelsLike, rainChance: data.hourly.precipitation_probability?.[index] }];
  }).slice(0, 3);
  return {
    feelsLike: data.current.apparent_temperature, temperature: data.current.temperature_2m,
    precipitation: Number.isFinite(data.current.precipitation) ? Math.max(0, data.current.precipitation) : 0,
    windSpeed: Number.isFinite(data.current.wind_speed_10m) ? Math.max(0, data.current.wind_speed_10m) : 0,
    isDay: data.current.is_day === undefined ? null : !!data.current.is_day,
    rainChance: Number.isFinite(data.daily.precipitation_probability_max?.[0]) ? Math.max(0, Math.min(100, data.daily.precipitation_probability_max[0])) : null,
    forecast, high: data.daily.temperature_2m_max[0], low: data.daily.temperature_2m_min[0],
    date: data.daily.time?.[0] || (typeof currentTime === 'string' ? currentTime.slice(0, 10) : ''),
    updated: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}
