import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthGrid,
  formatMonthHeading,
  shiftMonth,
} from './calendar';

test('shiftMonth handles year rollovers cleanly in both directions', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 1), {
    year: 2027,
    month: 0,
  });
  assert.deepEqual(shiftMonth({ year: 2026, month: 0 }, -1), {
    year: 2025,
    month: 11,
  });
});

test('buildMonthGrid always produces 42 cells starting on Monday and marks today', () => {
  const cells = buildMonthGrid({ year: 2026, month: 10 }, '2026-11-21');
  assert.equal(cells.length, 42);
  // Nov 1, 2026 is a Sunday, so Monday-first grid starts on Oct 26, 2026
  assert.equal(cells[0].isoDate, '2026-10-26');
  assert.equal(cells[0].inCurrentMonth, false);

  const todayCell = cells.find((c) => c.isToday);
  assert.ok(todayCell);
  assert.equal(todayCell.isoDate, '2026-11-21');
  assert.equal(todayCell.inCurrentMonth, true);
});

test('formatMonthHeading produces capitalized French month heading', () => {
  assert.equal(
    formatMonthHeading({ year: 2026, month: 10 }, 'fr'),
    'Novembre 2026'
  );
});
