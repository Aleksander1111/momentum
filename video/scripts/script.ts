// The narration's lines, in order, for the speech tools that are not written in TypeScript: out/script.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lineKey } from '../src/kit/voice.tsx';
import { SCRIPT } from '../src/Momentum.tsx';

const lines = SCRIPT.flatMap(({ scene, cues }) => cues.map((cue, i) => ({ key: lineKey(scene, i), text: cue.text })));
mkdirSync(fileURLToPath(new URL('../out', import.meta.url)), { recursive: true });
writeFileSync(fileURLToPath(new URL('../out/script.json', import.meta.url)), JSON.stringify(lines, null, 2) + '\n');
console.log(`${lines.length} lines`);
