import { readdir, readFile } from 'node:fs/promises';

const files = await readdir('dist', { recursive: true });
for (const path of files) {
  if (!/\.(?:js|html)$/.test(path)) continue;
  const source = await readFile(`dist/${path}`, 'utf8');
  if (/bizbox_integration_fixture_v1_|FIXTURE_WRITE_FAILURE|ТЕСТОВЫЙ TELEGRAM/.test(source)) {
    throw new Error(`Integration fixture leaked into production: ${path}`);
  }
}
console.log('Production bundle excludes the Telegram integration fixture.');
