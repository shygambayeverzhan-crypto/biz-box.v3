import test from 'node:test';
import assert from 'node:assert/strict';
import { chartPoints } from '../src/lib/chartGeometry.ts';

test('zero revenue stays at the baseline throughout animation', () => {
  for (const progress of [0, 0.25, 0.5, 1]) {
    const points = chartPoints([{ label: 'May', value: 0 }, { label: 'Jun', value: 0 }], 600, 150, progress);
    assert.ok(points.every(p => p.y === 132));
  }
});
test('larger income renders above smaller income and a single point is finite', () => {
  const points = chartPoints([{ label: 'A', value: 0 }, { label: 'B', value: 100 }, { label: 'C', value: 50 }], 600, 150);
  assert.ok(points[1].y < points[2].y && points[2].y < points[0].y);
  assert.equal(chartPoints([{ label: 'A', value: 100 }], 600, 150)[0].x, 300);
  assert.deepEqual(chartPoints([], 600, 150), []);
});
