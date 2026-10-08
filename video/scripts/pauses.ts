// Dead air in the whole cut: stretches where the picture stands still and no line is being said. Renders the cut small,
// measures each frame's change, and lists every such stretch longer than half a second.
import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition } from '@remotion/renderer';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { FPS } from '../src/kit/motion.ts';
import { CUTS, SCRIPT, SPOKEN } from '../src/Momentum.tsx';

const serveUrl = await bundle({ entryPoint: fileURLToPath(new URL('../src/index.ts', import.meta.url)) });
const composition = await selectComposition({ serveUrl, id: 'Momentum' });
const dir = mkdtempSync(join(tmpdir(), 'momentum-pauses-'));
await renderFrames({ serveUrl, composition, outputDir: dir, imageFormat: 'jpeg', jpegQuality: 70, scale: 0.1, inputProps: {}, onStart: () => {}, onFrameUpdate: () => {}, muted: true });
const files = readdirSync(dir).filter((f) => f.endsWith('.jpeg')).sort();
let prev: Buffer | null = null;
const motion: number[] = [];
for (const f of files) {
  const px = await sharp(join(dir, f)).greyscale().raw().toBuffer();
  let sum = 0;
  if (prev) for (let k = 0; k < px.length; k++) sum += Math.abs(px[k]! - prev[k]!);
  motion.push(prev ? sum / px.length : 0);
  prev = px;
}
const speaking = (t: number) => SPOKEN.some((s) => t >= s.from - 0.1 && t <= s.from + s.seconds + 0.1);
const sceneAt = (frame: number) => SCRIPT[CUTS.findLastIndex((c) => c <= frame)]!.scene;
// Still: less change than the camera's own drift makes
const STILL = 0.35;
const out: string[] = [];
for (let i = 0; i < motion.length; ) {
  if (motion[i]! >= STILL || speaking(i / FPS)) {
    i++;
    continue;
  }
  const from = i;
  while (i < motion.length && motion[i]! < STILL && !speaking(i / FPS)) i++;
  if (i - from >= FPS / 2) out.push(`${(from / FPS).toFixed(1)}–${(i / FPS).toFixed(1)} s  ${((i - from) / FPS).toFixed(1)} s  ${sceneAt(from)}`);
}
writeFileSync(fileURLToPath(new URL('../out/motion.json', import.meta.url)), JSON.stringify(motion));
writeFileSync(fileURLToPath(new URL('../out/pauses.txt', import.meta.url)), out.join('\n') + '\n');
console.log(out.length ? out.join('\n') : 'No dead air');
