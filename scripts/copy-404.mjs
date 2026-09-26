import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const index = join(dist, 'index.html');

if (!existsSync(index)) {
  console.error('[copy-404] dist/index.html not found - run the build first.');
  process.exit(1);
}

copyFileSync(index, join(dist, '404.html'));
console.log('[copy-404] wrote dist/404.html');
