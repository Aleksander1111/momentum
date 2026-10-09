// Validates the cut by measurement, not by looking: where every line is said in the whole video and for how long,
// whether every beat has the time its line needs, where every hold falls and whether anything moves there, and whether
// a move is still running when the next scene takes over. Every check reads the same data the render does: the cut,
// the lines' recorded lengths, the scenes' measured motion. The voice itself is checked by scripts/listen.py.
// Exits non-zero on any failure. Run: pnpm validate
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CUTS, SCRIPT } from '../src/Momentum.tsx';
import { dwell, dwelt, FPS } from '../src/kit/motion.ts';
import { beatEnd, HANDOVER, lineKey, MOTION, realFrame, shortBy, stillAt, TIMING, voiceDwells } from '../src/kit/voice.tsx';

/** Least silence between two lines */
const GAP = 15;
/** Mean change a pixel a frame above which a move is under way */
const MOVING = 0.5;
const fails: string[] = [];
const warns: string[] = [];
const t = (frame: number) => `${(frame / FPS).toFixed(2)} s`;

// Every line in the whole video: its scene, where it starts and ends, in real frames
const said: { key: string; scene: string; text: string; from: number; to: number }[] = [];
SCRIPT.forEach(({ scene, cues, frames }, s) => {
  const dwells = voiceDwells(scene, cues, frames);
  const length = dwelt(frames, dwells);
  const motion = MOTION[scene] ?? [];
  const moving = (a: number, b: number) => {
    const w = motion.slice(Math.max(0, Math.floor(a)), Math.ceil(b));
    return w.length ? w.reduce((x, y) => x + y, 0) / w.length : 0;
  };

  if (motion.length !== frames) fails.push(`${scene}: motion measured over ${motion.length} frames, the scene has ${frames}: run pnpm stillness`);

  // Holds: in order, and only where the picture stands still
  dwells.forEach(([at, len], i) => {
    if (i && at <= dwells[i - 1]![0]) fails.push(`${scene}: holds out of order at scene frame ${at}`);
    if (!stillAt(scene, at)) fails.push(`${scene}: holds for ${t(len)} at scene frame ${at}, where the picture moves (${moving(at - 3, at + 4).toFixed(2)})`);
  });
  // Every beat has the time its line needs: its own, or a hold at a still moment
  cues.forEach((cue, i) => {
    const short = shortBy(scene, cues, i, frames);
    const held = dwells.filter(([at]) => at > cue.at && at < beatEnd(cues, i, frames)).reduce((n, [, len]) => n + len, 0);
    if (short > held) fails.push(`${lineKey(scene, i)}: beat ${cue.at}–${beatEnd(cues, i, frames)} is ${Math.ceil(short - held)} frames short of its line and never stands still to wait`);
  });

  // Lines: recorded for their text, placed in the cut
  cues.forEach((cue, i) => {
    const rec = TIMING[lineKey(scene, i)];
    if (!rec || rec.text !== cue.text) {
      fails.push(`${lineKey(scene, i)}: no recording of "${cue.text}"`);
      return;
    }
    const from = CUTS[s]! + realFrame(cue.at, dwells);
    said.push({ key: lineKey(scene, i), scene, text: cue.text, from, to: from + rec.frames });
    // The line ends before the beat it describes gives way to the next one
    const nextAt = i + 1 < cues.length ? cues[i + 1]!.at : null;
    const end = realFrame(cue.at, dwells) + rec.frames;
    if (nextAt !== null && dwell(end, dwells) > nextAt) fails.push(`${lineKey(scene, i)}: still being said at scene frame ${dwell(end, dwells).toFixed(0)}, after the next beat at ${nextAt}`);
    if (end > length - HANDOVER) fails.push(`${lineKey(scene, i)}: ends at ${t(end)}, after the scene starts handing over at ${t(length - HANDOVER)}`);
  });

  // A move that starts before the next scene takes over and is still running then is cut off before it finishes. A
  // move that never stops (a spin, a time-lapse) is not: it is as fast at the handover as over the second before.
  if (s < SCRIPT.length - 1) {
    const handover = dwell(length - HANDOVER, dwells);
    const late = moving(handover - 4, handover);
    const before = moving(handover - 40, handover - 30);
    if (late >= MOVING && late > 1.5 * before) fails.push(`${scene}: a move starts at the end and is still running (${late.toFixed(2)}) when the next scene takes over at scene frame ${handover.toFixed(0)}`);
  }
});

// No two lines at once, and a breath between them, across scenes too
said.sort((a, b) => a.from - b.from);
for (let i = 1; i < said.length; i++) {
  const a = said[i - 1]!;
  const b = said[i]!;
  if (b.from < a.to) fails.push(`OVERLAP ${a.key} (${t(a.from)}–${t(a.to)}) and ${b.key} (from ${t(b.from)}): ${t(a.to - b.from)} of two voices at once`);
  else if (b.from - a.to < GAP) fails.push(`${a.key} → ${b.key}: only ${t(b.from - a.to)} between lines`);
}

// One voice throughout: every clip recorded by the same voice
const stamps = new Set(Object.values(TIMING).map((r) => r.voice));
if (stamps.size > 1) fails.push(`clips recorded by ${stamps.size} different voices: ${[...stamps].join(', ')}`);

writeFileSync(fileURLToPath(new URL('../out/timeline.json', import.meta.url)), JSON.stringify(said.map((l) => ({ ...l, from: l.from / FPS, to: l.to / FPS })), null, 2));
console.log(said.map((l) => `${t(l.from).padStart(9)} – ${t(l.to).padEnd(9)} ${l.key.padEnd(11)} ${l.text}`).join('\n'));
for (const w of warns) console.log(`WARN ${w}`);
for (const f of fails) console.log(`FAIL ${f}`);
console.log(`\n${fails.length} failures, ${warns.length} warnings`);
process.exitCode = fails.length ? 1 : 0;
