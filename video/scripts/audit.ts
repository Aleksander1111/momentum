// The layout audit: renders every `step`th frame of the whole cut with the audit on (src/kit/audit.tsx), and lists
// every piece of text a viewer could not read, with the frames it was seen at, and every headline, caption or line on
// screen that goes before it can be read: shown for less than a moment plus a third of a second a word.
// Writes out/audit.txt; exits non-zero on any finding. Run: pnpm audit [step]
import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition } from '@remotion/renderer';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTS, SCRIPT } from '../src/Momentum.tsx';
import { FPS } from '../src/kit/motion.ts';
import { HANDOVER } from '../src/kit/voice.tsx';

const [step = 3] = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: fileURLToPath(new URL('../src/index.ts', import.meta.url)) });
const composition = await selectComposition({ serveUrl, id: 'Audit' });
const found = new Map<string, number[]>();
const seen = new Map<string, number[]>();
const longest = new Map<string, string>();
const sceneOf = (frame: number) => SCRIPT[CUTS.findLastIndex((c) => c <= frame)]!.scene;

/** Frames a transition is under way: scenes slide and zoom through the frame's edge there on purpose */
const handing = (frame: number) => CUTS.some((c) => c > 0 && frame >= c && frame < c + HANDOVER);

await renderFrames({
  serveUrl,
  composition,
  outputDir: mkdtempSync(join(tmpdir(), 'momentum-audit-')),
  imageFormat: 'jpeg',
  scale: 0.25,
  everyNthFrame: step,
  muted: true,
  inputProps: {},
  onStart: () => {},
  onFrameUpdate: () => {},
  onBrowserLog: (log) => {
    const m = /^(AUDIT|READ) (\d+) (.*)$/.exec(log.text);
    if (!m) return;
    const frame = Number(m[2]);
    for (const item of JSON.parse(m[3]!) as string[]) {
      // A clock or a counter is the same text as its numbers change
      if (m[1] === 'READ') {
        // Text being typed is one text from its first words: keyed by its start, read as its longest
        const text = item.replace(/\d/g, '#');
        const key = text.slice(0, 16);
        if (text.length > (longest.get(key) ?? '').length) longest.set(key, text);
        seen.set(key, [...(seen.get(key) ?? []), frame]);
      }
      else if (!handing(frame)) {
        const key = `${sceneOf(frame)}: ${item}`;
        found.set(key, [...(found.get(key) ?? []), frame]);
      }
    }
  },
});

/** Layout findings that are the design, and why */
const DELIBERATE: [RegExp, string][] = [
  [/^Swipe: "Leave policy" covered/, 'the card waits dimmed behind the rework sheet'],
  [/^Resolve: "Remote days: three or two\?" covered by div "(CONTRADICTION|Remote work policy|Onboarding guide)/, 'the issue waits on the phone behind the two documents and their stamp until the seam opens'],
  [/^Loop: "Remote work policy" covered by div "Product · Feature/, 'the new card lands on the one waiting in the feed'],
  [/^Line: .* cut by the frame's edge/, "the closing wall runs past the frame, its edges masked"],
];
const report: string[] = [];
for (const [issue, frames] of [...found].sort((a, b) => a[1][0]! - b[1][0]!)) {
  const line = `${issue}  [${frames.length}× ${frames[0]}–${frames.at(-1)}]`;
  const why = DELIBERATE.find(([re]) => re.test(issue))?.[1];
  // Seen in one or two samples: something passing on its way through a move, never at rest
  if (why || frames.length <= 2) console.log(`accepted: ${line}: ${why ?? 'in passing, during a move'}`);
  else report.push(line);
}

/** Text that goes before it could be read on purpose, by scene and text, and why */
const INTENDED: [string, RegExp, string][] = [
  ['Resolve', /^Two remote days a week\.$/, 'the old value, read for seconds before, struck out and retyped as the fix lands'],
  ['Layers', /^(A priority for every to-do|Shared notes|Remote work policy)$/, 'cards from every project flying into the feed, and the phone going out of focus'],
  ['Loop', /^(Start|Work|Results|Write-up|Check|History|Your feed|You)$|^(a schedule, an event, or you|done by AI|documents and changes|into cards you can read|before it counts|everything recorded|most important first|approve · send back · ask)$/, 'the ring turning: a part shows its words at the front, and the phone keeps them'],
  ['Graph', /^(Start|Work|Results|Write-up|Check|History|Your feed|You)$/, "the Loop's ring, passing as the scene hands over"],
  ['Loop', /^(Onboarding, week one|Due dates|Sharing checks)$/, 'cards pouring in from every project at once'],
  ['Graph', /^(Book catalogue|Catalogue checks|Bookshelf|Bookshelf design|Book store|Book|Release process|Bookshelf source|Readers find a book fast)$/, 'cards flying home into the tree'],
  ['Schedule', /^(Plan|Idea|Task|Problem): /, 'the time-lapse: each run drops its card at its hour'],
  ['Learn', /^Book store$/, 'the next card arriving as the scene hands over'],
];

// Each stretch a text is on screen, sampled every `step` frames, against the time its words take to read
for (const [key, frames] of seen) {
  const text = longest.get(key) ?? key;
  frames.sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const f of frames) {
    const last = runs.at(-1);
    if (last && f - last[1] <= step) last[1] = f;
    else runs.push([f, f]);
  }
  const need = Math.round(FPS * (0.5 + text.split(' ').length / 3));
  for (const [a, b] of runs) {
    const shown = b - a + step;
    // Seen once: text being typed, or passing through a fade
    if (a === b) continue;
    const intended = INTENDED.find(([scene, re]) => scene === sceneOf(a) && re.test(text));
    if (intended && shown < need) {
      console.log(`accepted: "${text}" readable for ${(shown / FPS).toFixed(1)} s at ${(a / FPS).toFixed(1)} s: ${intended[2]}`);
      continue;
    }
    if (shown < need) report.push(`${sceneOf(a)}: "${text.slice(0, 60)}" readable for ${(shown / FPS).toFixed(1)} s at ${(a / FPS).toFixed(1)} s, needs ${(need / FPS).toFixed(1)} s`);
  }
}

writeFileSync(fileURLToPath(new URL('../out/audit.txt', import.meta.url)), report.join('\n') + '\n');
console.log(report.length ? report.join('\n') : 'No layout or reading issues');
console.log(`\n${report.length} findings`);
process.exitCode = report.length ? 1 : 0;
