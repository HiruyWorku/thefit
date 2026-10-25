import { localOutfitDate } from './saved-fits.mjs';

const localDate = value => new Date(`${value}T12:00:00`);
export const calendarMonth = date => date.slice(0, 7);
export function calendarDays(month) {
  const first = localDate(`${month}-01`);
  const offset = first.getDay();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first); date.setDate(1 - offset + index);
    return { date: localOutfitDate(date), number: date.getDate(), inMonth: date.getMonth() === first.getMonth() };
  });
}
export function shiftCalendarDays(date, amount) {
  const next = localDate(date); next.setDate(next.getDate() + amount); return localOutfitDate(next);
}
export function shiftCalendarMonth(date, amount) {
  const current = localDate(date);
  const last = new Date(current.getFullYear(), current.getMonth() + amount + 1, 0, 12).getDate();
  return localOutfitDate(new Date(current.getFullYear(), current.getMonth() + amount, Math.min(current.getDate(), last), 12));
}
export function calendarKeyboardDate(date, key) {
  const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (Object.hasOwn(offsets, key)) return shiftCalendarDays(date, offsets[key]);
  if (key === 'Home') return shiftCalendarDays(date, -localDate(date).getDay());
  if (key === 'End') return shiftCalendarDays(date, 6 - localDate(date).getDay());
  if (key === 'PageUp') return shiftCalendarMonth(date, -1);
  if (key === 'PageDown') return shiftCalendarMonth(date, 1);
  return null;
}
export function fitsByDate(fits) {
  const days = new Map();
  for (const fit of fits) days.set(fit.date, [...(days.get(fit.date) || []), fit]);
  return days;
}
