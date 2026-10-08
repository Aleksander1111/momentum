// Where each scene's picture stands still: renders every scene unheld at a small size, and records how much each
// frame differs from the one before into src/stillness.json. A line's hold is placed where the picture is still, so
// the scene never visibly slows down in the middle of a move.
import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition } from '@remotion/renderer';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SCRIPT } from '../src/Momentum.tsx';

const serveUrl = await bundle({ entryPoint: fileURLToPath(new URL('../src/index.ts', import.meta.url)) });
const motion: Record<string, number[]> = {};
for (const { scene } of SCRIPT) {
  const composition = await selectComposition({ serveUrl, id: `Unheld-${scene}` });
  const dir = mkdtempSync(join(tmpdir(), `momentum-still-${scene}-`));
  await renderFrames({ serveUrl, composition, outputDir: dir, imageFormat: 'jpeg', jpegQuality: 70, scale: 0.125, inputProps: {}, onStart: () => {}, onFrameUpdate: () => {}, muted: true });
  const files = readdirSync(dir).filter((f) => f.endsWith('.jpeg')).sort();
  const frames = await Promise.all(files.map((f) => sharp(join(dir, f)).greyscale().raw().toBuffer()));
  // Mean change of a pixel from the frame before, out of 255
  motion[scene] = frames.map((px, i) => {
    if (i === 0) return 0;
    const prev = frames[i - 1]!;
    let sum = 0;
    for (let k = 0; k < px.length; k++) sum += Math.abs(px[k]! - prev[k]!);
    return Math.round((sum / px.length) * 100) / 100;
  });
  console.log(`${scene}: ${files.length} frames`);
}
writeFileSync(fileURLToPath(new URL('../src/stillness.json', import.meta.url)), JSON.stringify(motion) + '\n');
