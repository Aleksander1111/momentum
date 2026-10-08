// The layout audit: renders a frame every `step` of the whole cut with the audit on (src/kit/audit.tsx), and lists
// every piece of text a viewer could not read, with the frames it was seen at. Run: pnpm audit [step] [from] [to]
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTS, SCRIPT } from '../src/Momentum.tsx';

const [step = 10, from = 0, to = Infinity] = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: fileURLToPath(new URL('../src/index.ts', import.meta.url)) });
const composition = await selectComposition({ serveUrl, id: 'Audit' });
const scratch = mkdtempSync(join(tmpdir(), 'momentum-audit-'));
const found = new Map<string, number[]>();
const sceneOf = (frame: number) => SCRIPT[CUTS.findLastIndex((c) => c <= frame)]!.scene;

/** Frames a transition is under way: scenes slide and zoom through the frame's edge there on purpose */
const HANDOVER = 20;
const handing = (frame: number) => CUTS.some((c) => c > 0 && frame >= c && frame < c + HANDOVER);

for (let frame = from; frame < Math.min(to, composition.durationInFrames); frame += step) {
  if (handing(frame)) continue;
  await renderStill({
    serveUrl,
    composition,
    frame,
    output: join(scratch, 'still.jpeg'),
    imageFormat: 'jpeg',
    scale: 0.25,
    onBrowserLog: (log) => {
      const m = /^AUDIT (\d+) (.*)$/.exec(log.text);
      if (!m) return;
      for (const issue of JSON.parse(m[2]!) as string[]) {
        const key = `${sceneOf(Number(m[1]))}: ${issue}`;
        found.set(key, [...(found.get(key) ?? []), Number(m[1])]);
      }
    },
  });
}

const report = [...found].sort((a, b) => a[1][0]! - b[1][0]!).map(([issue, frames]) => `${issue}  [${frames.length}× ${frames[0]}–${frames.at(-1)}]`);
writeFileSync(fileURLToPath(new URL('../out/audit.txt', import.meta.url)), report.join('\n') + '\n');
console.log(report.length ? report.join('\n') : 'No layout issues');
