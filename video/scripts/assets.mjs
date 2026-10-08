// The deck's slides, copied where Remotion serves them from: docs/slides stays the one source
import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('../../docs/slides', import.meta.url));
const to = fileURLToPath(new URL('../public/slides', import.meta.url));
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
