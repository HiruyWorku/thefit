import { useMemo, useRef } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { calendarDays, calendarKeyboardDate, calendarMonth, shiftCalendarMonth } from './outfit-calendar.mjs';
import { localOutfitDate } from './saved-fits.mjs';

export function OutfitCalendar({ selectedDate, onSelect, byDate }) {
  const grid = useRef(null);
  const month = calendarMonth(selectedDate);
  const days = useMemo(() => calendarDays(month), [month]);
  const title = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));
  const today = localOutfitDate();
  const weekdays = Array.from({ length: 7 }, (_, index) => new Date(2026, 9, 25 + index, 12));
  const choose = (date, focus = false) => {
    onSelect(date);
    if (focus) requestAnimationFrame(() => grid.current?.querySelector(`[data-calendar-date="${date}"]`)?.focus());
  };
  return <div className="outfit-calendar">
    <div className="outfit-calendar-toolbar"><div><button type="button" aria-label="Previous month" onClick={() => choose(shiftCalendarMonth(selectedDate, -1))}><CaretLeft size={18} aria-hidden="true" /></button><h3 id="fit-calendar-month">{title}</h3><button type="button" aria-label="Next month" onClick={() => choose(shiftCalendarMonth(selectedDate, 1))}><CaretRight size={18} aria-hidden="true" /></button></div><button type="button" className="calendar-today" onClick={() => choose(today)}>Today</button></div>
    <div role="grid" aria-labelledby="fit-calendar-month" className="outfit-calendar-grid" ref={grid}>
      <div role="row" className="calendar-weekdays">{weekdays.map(day => <span role="columnheader" key={day.getDay()} aria-label={new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(day)}>{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)}</span>)}</div>
      {Array.from({ length: 6 }, (_, week) => <div role="row" className="calendar-week" key={week}>{days.slice(week * 7, week * 7 + 7).map(day => {
        const fits = byDate.get(day.date) || [];
        const label = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${day.date}T12:00:00`));
        const thumbnail = fits[0]?.previewImage || fits[0]?.items[0]?.image;
        return <div role="gridcell" key={day.date} aria-selected={selectedDate === day.date}><button type="button" className={`calendar-day${day.inMonth ? '' : ' is-outside'}${fits.length ? ' has-fits' : ''}`} data-calendar-date={day.date} tabIndex={selectedDate === day.date ? 0 : -1} aria-current={day.date === today ? 'date' : undefined} aria-pressed={selectedDate === day.date} aria-label={`${label}, ${fits.length} saved ${fits.length === 1 ? 'fit' : 'fits'}`} onClick={() => choose(day.date)} onKeyDown={event => { const next = calendarKeyboardDate(day.date, event.key); if (next) { event.preventDefault(); choose(next, true); } }}>
          <span className="calendar-day-number">{day.number}</span>{thumbnail && <img src={thumbnail} alt="" loading="lazy" aria-hidden="true" />}{!!fits.length && <span className="calendar-day-count">{fits.length} {fits.length === 1 ? 'fit' : 'fits'}</span>}
        </button></div>;
      })}</div>)}
    </div>
    <p className="calendar-hint">Days with a garment thumbnail have saved fits. Select a day to see them.</p>
  </div>;
}
