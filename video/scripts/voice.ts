// Records the narration with Kokoro, an open-weight text-to-speech model (Apache-2.0) that runs on any OS: each scene in
// one take, cut into its lines in public/voice/, and each line's length into src/voice.json, which the scenes hold
// their beats by. A scene whose lines have not changed since they were recorded is kept. The model (about 330 MB) is
// fetched from Hugging Face on the first run and cached.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KokoroTTS } from 'kokoro-js';
import { FPS } from '../src/kit/motion.ts';
import { lineKey, TIMING } from '../src/kit/voice.tsx';
import { SCRIPT } from '../src/Momentum.tsx';

const VOICE = (process.env.MOMENTUM_VOICE ?? 'af_heart') as 'af_heart';
const SPEED = Number(process.env.MOMENTUM_VOICE_SPEED ?? 0.95);

const dir = fileURLToPath(new URL('../public/voice', import.meta.url));
const timingFile = fileURLToPath(new URL('../src/voice.json', import.meta.url));
mkdirSync(dir, { recursive: true });

const lines = SCRIPT.flatMap(({ scene, cues }) => cues.map((cue, i) => ({ key: lineKey(scene, i), text: cue.text, file: `${lineKey(scene, i)}.wav` })));
// A recording is kept only if it is of the same text by the same voice
const stamp = `${VOICE}@${SPEED}/take`;
const todo = lines.filter((l) => TIMING[l.key]?.text !== l.text || (TIMING[l.key] as { voice?: string } | undefined)?.voice !== stamp || !existsSync(`${dir}/${l.file}`));

/** 16-bit mono WAV, which every player and Remotion take */
function wav(samples: Float32Array, rate: number): Buffer {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
  return b;
}

/**
 * A scene's narration is spoken in one take, so its intonation runs on from line to line like a person reading it,
 * then cut into lines at the pauses nearest where each line should begin
 */
function split(take: Float32Array, rate: number, texts: string[]): Float32Array[] {
  // Pauses: runs of at least 90 ms quieter than the voice's breath
  const win = Math.round(rate / 100);
  const loud = Array.from({ length: Math.floor(take.length / win) }, (_, w) => {
    let e = 0;
    for (let i = w * win; i < (w + 1) * win; i++) e = Math.max(e, Math.abs(take[i]!));
    return e > 0.02;
  });
  const pauses: { from: number; to: number }[] = [];
  for (let w = 0; w < loud.length; ) {
    if (loud[w]) {
      w++;
      continue;
    }
    const from = w;
    while (w < loud.length && !loud[w]) w++;
    if (w - from >= 9 && from > 0 && w < loud.length) pauses.push({ from: from * win, to: w * win });
  }
  // Where each line should begin, by its share of the letters
  const total = texts.reduce((n, t) => n + t.length, 0);
  const cuts: number[] = [];
  let before = 0;
  for (let k = 1; k < texts.length; k++) {
    before += texts[k - 1]!.length;
    const expected = (before / total) * take.length;
    const after = cuts.at(-1) ?? 0;
    const best = pauses
      .filter((p) => p.from > after)
      .map((p) => ({ p, score: Math.abs((p.from + p.to) / 2 - expected) - 0.5 * (p.to - p.from) }))
      .sort((x, y) => x.score - y.score)[0];
    cuts.push(best ? Math.round((best.p.from + best.p.to) / 2) : Math.round(expected));
  }
  const bounds = [0, ...cuts, take.length];
  return texts.map((_, k) => {
    // Each line from just before its first sound to a breath after its last
    let a = bounds[k]!;
    let b = bounds[k + 1]!;
    while (a < b && Math.abs(take[a]!) < 0.01) a++;
    while (b > a && Math.abs(take[b - 1]!) < 0.01) b--;
    return take.slice(Math.max(bounds[k]!, a - Math.round(0.04 * rate)), Math.min(bounds[k + 1]!, b + Math.round(0.15 * rate)));
  });
}

const scenes = [...new Set(todo.map((l) => l.key.split('-')[0]!))];
if (scenes.length) {
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp32', device: 'cpu' });
  for (const scene of scenes) {
    const own = lines.filter((l) => l.key.startsWith(`${scene}-`));
    const take = await tts.generate(own.map((l) => l.text).join(' '), { voice: VOICE, speed: SPEED });
    split(take.audio, take.sampling_rate, own.map((l) => l.text)).forEach((part, k) => writeFileSync(`${dir}/${own[k]!.file}`, wav(part, take.sampling_rate)));
    process.stdout.write(`${scene} `);
  }
  console.log();
}

/** A recording's length, less the silence the voice leaves at its end */
function framesOf(path: string): number {
  const b = readFileSync(path);
  const rate = b.readUInt32LE(24);
  const count = b.readUInt32LE(40) / 2;
  let end = count;
  while (end > 0 && Math.abs(b.readInt16LE(44 + (end - 1) * 2)) < 300) end--;
  return Math.ceil((end / rate) * FPS);
}

const timing = Object.fromEntries(lines.map((l) => [l.key, { file: l.file, frames: framesOf(`${dir}/${l.file}`), text: l.text, voice: stamp }]));
writeFileSync(timingFile, JSON.stringify(timing, null, 2) + '\n');
const total = Object.values(timing).reduce((s, t) => s + t.frames, 0) / FPS;
console.log(`${lines.length} lines (${todo.length} recorded), ${total.toFixed(1)} s spoken`);
