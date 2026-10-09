// The picture's flow through the whole cut. Renders the cut small and measures each frame's change, then lists dead air
// (stretches longer than half a second where the picture stands still and no line is being said) and fails on any jump:
// a frame that changes far more than the frames around it outside a transition, which is a move that skips instead of
// running, or on dead air over two seconds, which reads as the video stalling. Writes out/pauses.txt. Run: pnpm pauses
import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition } from '@remotion/renderer';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { FPS } from '../src/kit/motion.ts';
import { CUTS, SCRIPT, SPOKEN } from '../src/Momentum.tsx';
import { HANDOVER } from '../src/kit/voice.tsx';

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
// Jumps: a frame whose change is several times that of the frames around it, away from the scenes' handovers
const handing = (i: number) => CUTS.some((c) => c > 0 && i >= c - 2 && i < c + HANDOVER + 2);
const jumps: string[] = [];
for (let i = 1; i < motion.length; i++) {
  if (handing(i)) continue;
  const around = [...motion.slice(Math.max(1, i - 6), i), ...motion.slice(i + 1, i + 7)].sort((a, b) => a - b);
  const usual = around[Math.floor(around.length / 2)] ?? 0;
  if (motion[i]! > 3 && motion[i]! > 4 * usual + 1) jumps.push(`JUMP at ${(i / FPS).toFixed(2)} s (frame ${i}) in ${sceneAt(i)}: change ${motion[i]!.toFixed(1)}, around it ${usual.toFixed(1)}`);
}
writeFileSync(fileURLToPath(new URL('../out/motion.json', import.meta.url)), JSON.stringify(motion));
writeFileSync(fileURLToPath(new URL('../out/pauses.txt', import.meta.url)), [...out, ...jumps].join('\n') + '\n');
console.log(out.length ? out.join('\n') : 'No dead air');
console.log(jumps.length ? jumps.join('\n') : 'No jumps');
// A still, silent stretch longer than this reads as the video stalling
const STALL = 2;
const stalls = out.filter((l) => Number(/ (\d+\.\d) s /.exec(l)?.[1] ?? 0) > STALL);
for (const l of stalls) console.log(`STALL ${l}`);
process.exitCode = jumps.length || stalls.length ? 1 : 0;
