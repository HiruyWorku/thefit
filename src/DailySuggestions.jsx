import { useEffect, useMemo, useRef, useState } from 'react';
import { OptimizedImage } from './OptimizedImage.jsx';
import { suggestOutfit } from './daily-outfit.mjs';

export function DailySuggestions({ items, onOpen }) {
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [variation, setVariation] = useState(0);
  const [tryOn, setTryOn] = useState({ key: '', status: 'idle' });
  const [liveTryOn, setLiveTryOn] = useState(false);
  const [LiveTryOn, setLiveTryOnComponent] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');
  const liveImportLock = useRef(false);
  const openLiveTryOn = async () => {
    if (liveImportLock.current) return;
    setLiveError('');
    if (LiveTryOn) { setLiveTryOn(true); return; }
    liveImportLock.current = true;
    setLiveLoading(true);
    try {
      const module = await import('./LiveTryOn.jsx');
      setLiveTryOnComponent(() => module.LiveTryOn);
      setLiveTryOn(true);
    } catch {
      setLiveError('The live camera could not load. Refresh the page and try again.');
    } finally { liveImportLock.current = false; setLiveLoading(false); }
  };
  const tryOnLock = useRef(false);
  const [unit, setUnit] = useState('F');
  const request = useRef(0);
  const location = useRef(null);
  const controller = useRef(null);
  const outfit = useMemo(() => weather ? suggestOutfit(items, weather, variation) : null, [items, weather, variation]);
  const outfitKey = JSON.stringify(outfit?.chosen.map(({ item }) => [item.id, item.name, item.part, item.color, item.secondaryColor, item.tags, item.image]) || []);
  const activeTryOn = tryOn.key === outfitKey ? tryOn : null;
  const generateTryOn = async () => {
    if (tryOnLock.current || !outfit?.chosen.length || activeTryOn?.status === 'ready') return;
    tryOnLock.current = true;
    const key = outfitKey;
    setTryOn({ key, status: 'loading' });
    try {
      const response = await fetch('/api/outfits/try-on', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemIds: outfit.chosen.map(({ item }) => item.id) }) });
      const result = await response.json();
      if (!response.ok || !result.imageDataUrl) throw new Error(result.error || 'Could not generate your preview.');
      setTryOn({ key, status: 'ready', image: result.imageDataUrl, expanded: true });
    } catch (err) { setTryOn({ key, status: 'error', error: err.message }); }
    finally { tryOnLock.current = false; }
  };
  const temperature = value => `${Math.round(unit === 'F' ? value * 9 / 5 + 32 : value)}°${unit}`;

  const loadWeather = async (coords, token) => {
    try {
      controller.current?.abort();
      controller.current = new AbortController();
      const timeout = setTimeout(() => controller.current?.abort(), 15000);
      let response;
      let data;
      try {
        const params = new URLSearchParams({ latitude: coords.latitude.toFixed(2), longitude: coords.longitude.toFixed(2), current: 'temperature_2m,apparent_temperature,precipitation', daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max', timezone: 'auto', forecast_days: '1' });
        response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.current.signal });
        data = await response.json();
      } finally { clearTimeout(timeout); }
      if (!response.ok || !Number.isFinite(data.current?.apparent_temperature) || !Number.isFinite(data.current?.temperature_2m) || !Number.isFinite(data.daily?.temperature_2m_max?.[0]) || !Number.isFinite(data.daily?.temperature_2m_min?.[0])) throw new Error('Weather is unavailable right now. Please try again.');
      if (token !== request.current) return;
      setWeather({ feelsLike: data.current.apparent_temperature, temperature: data.current.temperature_2m, precipitation: data.current.precipitation || 0, rainChance: data.daily.precipitation_probability_max?.[0] || 0, high: data.daily.temperature_2m_max[0], low: data.daily.temperature_2m_min[0], date: data.daily.time[0], updated: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) });
      setError('');
    } catch (err) { if (token === request.current) { setWeather(null); setError(err.name === 'AbortError' ? 'Weather request timed out. Please try again.' : err.message); } }
    finally { if (token === request.current) setBusy(false); }
  };

  const locate = () => {
    if (busy) return;
    if (!navigator.geolocation) { setError('Location is unavailable in this browser. Open the app on HTTPS or localhost.'); return; }
    const token = ++request.current;
    setBusy(true); setError(''); setWeather(null);
    navigator.geolocation.getCurrentPosition(position => {
      if (token !== request.current) return;
      location.current = position.coords;
      loadWeather(position.coords, token);
    }, err => {
      if (token !== request.current) return;
      setBusy(false);
      setError(err.code === 1 ? 'Location permission was denied. Allow location in your browser settings, then try again.' : 'Could not find your location. Please try again.');
    }, { timeout: 12000, maximumAge: 300000, enableHighAccuracy: false });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (!location.current) return;
      const token = ++request.current;
      setBusy(true);
      loadWeather(location.current, token);
    }, 30 * 60 * 1000);
    return () => { clearInterval(timer); request.current++; controller.current?.abort(); };
  }, []);

  return <section className={`daily-panel${weather ? ' has-weather' : ''}`} aria-labelledby="daily-title">
    <div className="daily-intro">
      <div className="daily-topline"><span className="daily-eyebrow">Your daily edit</span><button className="daily-unit" aria-label="Toggle temperature units" onClick={() => setUnit(value => value === 'F' ? 'C' : 'F')}>°{unit}</button></div>
      <h2 id="daily-title">A little less<br />“what to wear?”</h2>
      <p className="daily-description">{weather ? outfit.summary : 'A look from your own wardrobe, picked for the weather outside.'}</p>
      {weather && <div className="daily-weather"><strong>{temperature(weather.temperature)}</strong><div><span>Feels like {temperature(weather.feelsLike)}</span><span>High {temperature(weather.high)} · Low {temperature(weather.low)}</span><span>{weather.rainChance}% chance of rain</span></div></div>}
      <div className="daily-controls"><button className="daily-location" disabled={busy} onClick={locate}>{busy ? 'Checking weather…' : weather ? '↻ Refresh location' : 'Use my location ↗'}</button>{weather && !!items.length && <button className="daily-shuffle" onClick={() => setVariation(value => value + 1)}>Try another look ↗</button>}</div>
      {busy && <p role="status" className="daily-note">Finding the weather for you…</p>}
      {error && <p role="alert" className="daily-note daily-error">{error}</p>}
      {!weather && <p className="daily-note">Location is optional. Approximate coordinates are shared with Open-Meteo to check the weather.</p>}
      {weather && <p className="daily-note">Near you · {weather.date} · Updated {weather.updated}</p>}
      <a className="daily-credit" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather by Open-Meteo</a>
    </div>
    <div className="daily-look">
      <div className="daily-look-heading"><h3>Today's outfit</h3><span>{weather && outfit.chosen.length ? `${outfit.chosen.length} pieces · head to toe` : 'Picked from your wardrobe'}</span></div>
      {weather && !!items.length ? <>
        <ol className="daily-outfit" aria-label="Suggested outfit from head to toe">{outfit.chosen.map(({ slot, item }, index) => <li key={item.id}><button onClick={() => onOpen(item.id)} aria-label={`Edit suggested ${item.name}`}><span className="daily-number">{String(index + 1).padStart(2, '0')}</span><OptimizedImage src={item.image} alt={item.name} sizes="110px" breakpoints={[160, 240, 320]} /><span className="daily-item-label"><span className="daily-slot">{slot}</span><span className="daily-item-name">{item.name}</span></span><span className="daily-item-arrow" aria-hidden="true">↗</span></button></li>)}</ol>
        {!!outfit.missing.length && <p className="daily-note">Missing: {outfit.missing.join(', ').toLowerCase()}. Showing the pieces you have.</p>}
        <div className="daily-try-on">
          <button className="daily-live-try-on" onClick={openLiveTryOn} disabled={liveLoading}>{liveLoading ? 'Loading camera…' : 'See this outfit live ↗'}</button>
          {liveError && <p className="daily-note daily-error" role="alert">{liveError}</p>}
          <button className="daily-location" disabled={tryOn.status === 'loading'} aria-expanded={activeTryOn?.status === 'ready' ? activeTryOn.expanded : undefined} aria-controls={activeTryOn?.status === 'ready' ? 'daily-outfit-preview' : undefined} onClick={() => activeTryOn?.status === 'ready' ? setTryOn(current => ({ ...current, expanded: !current.expanded })) : generateTryOn()}>{tryOn.status === 'loading' ? 'Creating your preview…' : activeTryOn?.status === 'ready' ? activeTryOn.expanded ? 'Hide preview' : 'Show preview' : 'Try this look on me'}</button>
          <p className="daily-note">Uses your reference photo and these pieces to create an AI preview. Images are sent to OpenAI. Actual fit may differ.</p>
          {tryOn.status === 'loading' && <p className="daily-note" role="status">Generating your look. This can take a few minutes.</p>}
          {activeTryOn?.status === 'error' && <p className="daily-note daily-error" role="alert">{activeTryOn.error}</p>}
          {activeTryOn?.status === 'ready' && <figure id="daily-outfit-preview" className="daily-try-on-result" hidden={!activeTryOn.expanded}><img src={activeTryOn.image} alt="AI preview of you wearing the suggested outfit" /><figcaption>AI outfit preview</figcaption><a href={activeTryOn.image} download="my-outfit.png">Download preview ↗</a></figure>}
        </div>
        <details className="daily-match-help"><summary>How these pieces were picked</summary><p className="daily-note">We match the weather with your item names and details. Words like “T-shirt,” “shorts,” and “waterproof” help. Click any piece to edit it.</p></details>
      </> : <div className="daily-empty"><div className="daily-empty-mark" aria-hidden="true">＋</div><h4>{weather ? 'Your next look starts here.' : 'Let the forecast dress you.'}</h4><p>{weather ? 'Add a few pieces to your wardrobe and we’ll put them together.' : 'Share your location to see a head-to-toe outfit using pieces you already own.'}</p><span>HAT · TOP · BOTTOMS · SHOES</span></div>}
    </div>
    {liveTryOn && LiveTryOn && <LiveTryOn outfit={outfit} onClose={() => setLiveTryOn(false)} />}
  </section>;
}
