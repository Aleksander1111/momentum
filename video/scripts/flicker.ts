// Flicker in the rendered picture: frames drawn softer or sharper than the frames either side of them, which the
// browser does now and then with text on a turned 3D layer. Renders the whole cut at half size, measures each frame's
// sharpness (its mean edge strength), and fails on any frame that stands out from both neighbours while they agree.
// Writes out/flicker.json. Run: pnpm flicker [composition] [from] [to]
import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition } from '@remotion/renderer';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { dwell, FPS } from '../src/kit/motion.ts';
import { CUTS, SCRIPT } from '../src/Momentum.tsx';
import { HANDOVER, voiceDwells } from '../src/kit/voice.tsx';

const id = process.argv[2] ?? 'Momentum';
const [first, last] = process.argv.slice(3).map(Number);
const serveUrl = await bundle({ entryPoint: fileURLToPath(new URL('../src/index.ts', import.meta.url)) });
const composition = await selectComposition({ serveUrl, id });
const dir = mkdtempSync(join(tmpdir(), 'momentum-flicker-'));
await renderFrames({ serveUrl, composition, outputDir: dir, imageFormat: 'png', scale: 0.5, ...(first !== undefined ? { frameRange: [first, last ?? first + 100] as [number, number] } : {}), inputProps: {}, onStart: () => {}, onFrameUpdate: () => {}, muted: true });
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const LAPLACE = { width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 };
const sharpness: number[] = [];
for (const f of files) {
  const px = await sharp(join(dir, f)).greyscale().convolve(LAPLACE).raw().toBuffer();
  let sum = 0;
  for (let k = 0; k < px.length; k++) sum += Math.abs(px[k]! - 128);
  sharpness.push(sum / px.length);
}
const base = first ?? 0;
const sceneAt = (frame: number) => (id === 'Momentum' ? SCRIPT[CUTS.findLastIndex((c) => c <= frame)]!.scene : id);
const handing = (i: number) => id === 'Momentum' && CUTS.some((c) => c > 0 && i >= c - 2 && i < c + HANDOVER + 2);
/** Frames that stand out by design, in a scene's own time, and why */
const DELIBERATE: [scene: string, from: number, to: number, why: string][] = [['Learn', 305, 325, 'the four cards turn edge-on together']];
/** The scene a frame of the composition is in, and that scene's own time there */
const placeOf = (i: number) => {
  const k = id === 'Momentum' ? CUTS.findLastIndex((c) => c <= i) : SCRIPT.findIndex((s) => s.scene === id);
  const s = SCRIPT[k]!;
  return { scene: s.scene, at: dwell(i - (id === 'Momentum' ? CUTS[k]! : 0), voiceDwells(s.scene, s.cues, s.frames)) };
};
const flicker: string[] = [];
for (let n = 1; n + 1 < sharpness.length; n++) {
  const i = base + n;
  if (handing(i)) continue;
  const [a, s, b] = [sharpness[n - 1]!, sharpness[n]!, sharpness[n + 1]!];
  const agree = Math.abs(a - b) / Math.max(a, b);
  const off = Math.min(Math.abs(s - a) / a, Math.abs(s - b) / b);
  if (agree >= 0.02 || off <= 0.04) continue;
  const { scene, at } = placeOf(i);
  const why = DELIBERATE.find(([n, a, b]) => n === scene && at >= a && at <= b)?.[3];
  if (why) console.log(`accepted: frame ${i} in ${scene}: ${why}`);
  else flicker.push(`FLICKER at ${(i / FPS).toFixed(2)} s (frame ${i}) in ${sceneAt(i)}: sharpness ${s.toFixed(2)}, either side ${a.toFixed(2)} and ${b.toFixed(2)}`);
}
writeFileSync(fileURLToPath(new URL('../out/flicker.json', import.meta.url)), JSON.stringify(sharpness));
console.log(flicker.length ? flicker.join('\n') : 'No flicker');
console.log(`\n${sharpness.length} frames, ${flicker.length} flickering`);
process.exitCode = flicker.length ? 1 : 0;
