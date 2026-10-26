import test from 'node:test';
import assert from 'node:assert/strict';
import { relativeDate, localDateValue } from '../src/lib/format.ts';

test('a calendar date stays today after noon and dates use local calendar days', () => {
  const evening = new Date(2026, 9, 26, 23, 30);
  assert.equal(relativeDate('2026-10-26', evening), 'Сегодня');
  assert.equal(relativeDate('2026-10-25', evening), 'Вчера');
  assert.equal(relativeDate('2026-10-27', evening), 'Завтра');
  assert.equal(localDateValue(new Date(2026, 9, 26, 0, 30)), '2026-10-26');
});
