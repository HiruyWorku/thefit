import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDays, calendarKeyboardDate, fitsByDate, shiftCalendarDays, shiftCalendarMonth } from '../src/outfit-calendar.mjs';

test('a calendar month has complete weeks with adjacent dates and no duplicates', () => {
  const days = calendarDays('2026-10');
  assert.equal(days.length, 42);
  assert.equal(new Set(days.map(day => day.date)).size, 42);
  assert.equal(days[0].date, '2026-09-27');
  assert.equal(days.filter(day => day.inMonth).length, 31);
  assert.equal(days.find(day => day.date === '2026-10-25').number, 25);
});
test('month navigation handles leap days, short months and year boundaries', () => {
  assert.equal(calendarDays('2024-02').filter(day => day.inMonth).length, 29);
  assert.equal(shiftCalendarMonth('2024-01-31', 1), '2024-02-29');
  assert.equal(shiftCalendarMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(shiftCalendarMonth('2026-12-25', 1), '2027-01-25');
  assert.equal(shiftCalendarDays('2026-12-31', 1), '2027-01-01');
});
test('keyboard navigation follows days and weeks across month boundaries', () => {
  assert.equal(calendarKeyboardDate('2026-10-31', 'ArrowRight'), '2026-11-01');
  assert.equal(calendarKeyboardDate('2026-10-25', 'ArrowUp'), '2026-10-18');
  assert.equal(calendarKeyboardDate('2026-10-28', 'Home'), '2026-10-25');
  assert.equal(calendarKeyboardDate('2026-10-28', 'End'), '2026-10-31');
  assert.equal(calendarKeyboardDate('2026-10-25', 'PageDown'), '2026-11-25');
  assert.equal(calendarKeyboardDate('2026-10-25', 'Tab'), null);
});
test('calendar day markers group multiple fits without mixing dates', () => {
  const fits = [{ id: 'a', date: '2026-10-25' }, { id: 'b', date: '2026-10-25' }, { id: 'c', date: '2026-10-24' }];
  const grouped = fitsByDate(fits);
  assert.deepEqual(grouped.get('2026-10-25').map(fit => fit.id), ['a', 'b']);
  assert.equal(grouped.get('2026-10-24').length, 1);
  assert.equal(grouped.has('2026-10-26'), false);
});
