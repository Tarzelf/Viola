import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderThemeCss } from '../src/css';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'src', 'theme.css');

writeFileSync(out, renderThemeCss(), 'utf8');
console.log(`wrote ${out}`);
