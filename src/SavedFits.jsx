import { useEffect, useMemo, useState } from 'react';
import { OptimizedImage } from './OptimizedImage.jsx';
import { fitDateLabel, localOutfitDate } from './saved-fits.mjs';
import { fitsByDate } from './outfit-calendar.mjs';
import { OutfitCalendar } from './OutfitCalendar.jsx';

export function SavedFits({ onLoad, onBuild }) {
  const [fits, setFits] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => localOutfitDate());
  const byDate = useMemo(() => fitsByDate(fits), [fits]);
  const selectedFits = byDate.get(selectedDate) || [];
  useEffect(() => {
    const controller = new AbortController();
    setState('loading'); setError('');
    fetch('/api/outfits/saved', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Could not load your saved fits.');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Could not load your saved fits.');
      setFits(rows); setState('ready');
    }).catch(error => { if (error.name !== 'AbortError') { setError(error.message); setState('error'); } });
    return () => controller.abort();
  }, [attempt]);
  return <section className="saved-fits" aria-labelledby="saved-fits-title">
    <div className="saved-fits-heading"><div><h2 id="saved-fits-title">Your outfit calendar</h2><p>Pick a day to revisit the looks you saved.</p></div><button type="button" className="daily-customize" onClick={onBuild}>Build another fit</button></div>
    {state === 'loading' && <p role="status">Loading your saved fits…</p>}
    {state === 'error' && <div role="alert"><p>{error}</p><button type="button" className="daily-customize" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
    {state === 'ready' && <div className="saved-calendar-layout">
    <OutfitCalendar selectedDate={selectedDate} onSelect={setSelectedDate} byDate={byDate} />
    <div className="saved-day-fits" aria-live="polite"><div className="saved-day-heading"><h3>{fitDateLabel(selectedDate)}</h3><span>{selectedFits.length} saved {selectedFits.length === 1 ? 'fit' : 'fits'}</span></div>
    {!selectedFits.length && <p className="saved-fits-empty">{fits.length ? 'No fit saved for this day. Choose a marked day to revisit a look.' : 'Your calendar is ready. Build a fit or choose a suggestion, then select “Save fit of the day.”'}</p>}
    <div className="saved-fits-grid">{selectedFits.map(fit => <article className="saved-fit" key={fit.id}>
      <div className="saved-fit-heading"><h3>{fitDateLabel(fit.date)}</h3><span>{fit.items.length} {fit.items.length === 1 ? 'piece' : 'pieces'}</span></div>
      {fit.previewImage ? <img className="saved-fit-preview" src={fit.previewImage} alt={`Saved AI try-on preview from ${fitDateLabel(fit.date)}`} loading="lazy" /> : <div className="saved-fit-pieces" aria-label="Saved outfit pieces">{fit.items.map(item => <OptimizedImage key={item.id} src={item.image} alt={item.name} sizes="160px" breakpoints={[160, 320]} />)}</div>}
      <ul className="saved-fit-names">{fit.items.map(item => <li key={item.id}>{item.name}</li>)}</ul>
      <button type="button" className="daily-customize" onClick={() => onLoad(fit)}>Load in builder</button>
    </article>)}</div>
    </div>
    </div>}
  </section>;
}
