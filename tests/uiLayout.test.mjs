import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../src/components/Navigation.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');

test('Shared surfaces do not override mobile dock fixed positioning', () => {
  assert.match(css, /\.liquid-dock\s*\{\s*position:\s*fixed\s*;/);
  assert.doesNotMatch(css, /\.glass-strong\s*\{[^}]*position:\s*relative/);
  assert.doesNotMatch(css, /\.liquid-card,\s*\.liquid-panel,\s*\.glass,\s*\.glass-strong\s*\{\s*position:\s*relative/);
  assert.match(navigation, /className="liquid-dock lg:hidden z-40 glass-strong"/);
});

test('Topbar keeps sticky placement and does not get a relative glass override', () => {
  assert.doesNotMatch(css, /\.glass\s*\{[^}]*position:\s*relative/);
  assert.match(layout, /className="app-topbar sticky/);
});
