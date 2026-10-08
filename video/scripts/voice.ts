// Records the narration with Gemini's text-to-speech (voice Sulafat): each scene read in one take, so its intonation
// carries from line to line, with a clear break asked for between lines. The take is cut into its lines only at its
// longest pauses, one fewer than it has lines, so a pause inside a sentence can never become a cut; a scene whose cut
// does not check out is reported. A line's own pauses are shortened to a breath. Lines go to public/voice/, their lengths to src/voice.json, which
// the scenes hold their beats by. A scene whose lines have not changed since they were recorded is kept.
// Needs GEMINI_API_KEY; MOMENTUM_VOICE picks the voice, MOMENTUM_TTS_MODEL the models tried in turn.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FPS } from '../src/kit/motion.ts';
import { lineKey, TIMING } from '../src/kit/voice.tsx';
import { SCRIPT } from '../src/Momentum.tsx';

const KEY = process.env.GEMINI_API_KEY;
const VOICE = process.env.MOMENTUM_VOICE ?? 'Sulafat';
const MODELS = (process.env.MOMENTUM_TTS_MODEL ?? 'gemini-3.8-flash-tts,gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts').split(',');
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const DIRECTION =
  'Read the following aloud as the narrator of a short, calm product film: warm, natural, unhurried, like a person ' +
  'talking to one listener. Each paragraph is one line. Leave a clear pause of about one and a half seconds between ' +
  'paragraphs, and never pause inside a sentence for longer than a short breath.';

const dir = fileURLToPath(new URL('../public/voice', import.meta.url));
const timingFile = fileURLToPath(new URL('../src/voice.json', import.meta.url));
mkdirSync(dir, { recursive: true });
const takes = fileURLToPath(new URL('../public/takes', import.meta.url));
mkdirSync(takes, { recursive: true });

const lines = SCRIPT.flatMap(({ scene, cues }) => cues.map((cue, i) => ({ key: lineKey(scene, i), text: cue.text, file: `${lineKey(scene, i)}.wav` })));
// A recording is kept only if it is of the same text by the same voice
const stamp = `gemini:${VOICE}:${MODELS[0]}`;
const stale = (l: (typeof lines)[number]) => TIMING[l.key]?.text !== l.text || TIMING[l.key]?.voice !== stamp || !existsSync(`${dir}/${l.file}`);

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

/** The samples of a 16-bit mono WAV, or of raw 16-bit PCM */
function samplesOf(data: Buffer, mime: string): { audio: Float32Array; rate: number } {
  let pcm = data;
  let rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
  if (data.toString('ascii', 0, 4) === 'RIFF') {
    rate = data.readUInt32LE(24);
    const at = data.indexOf('data', 12);
    pcm = data.subarray(at + 8, at + 8 + data.readUInt32LE(at + 4));
  }
  const audio = new Float32Array(Math.floor(pcm.length / 2));
  for (let i = 0; i < audio.length; i++) audio[i] = pcm.readInt16LE(i * 2) / 32768;
  return { audio, rate };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Speech for `text`, waiting out the free tier's few requests a minute */
async function speak(text: string, direction = DIRECTION): Promise<{ audio: Float32Array; rate: number }> {
  if (!KEY) throw new Error('Set GEMINI_API_KEY to record the narration');
  for (let attempt = 0; attempt < 12; attempt++) {
    for (const model of MODELS) {
      const res = await fetch(`${API}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${direction}\n\n${text}` }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
        }),
      });
      const body = (await res.json()) as { candidates?: { content: { parts: { inlineData?: { mimeType: string; data: string } }[] } }[]; error?: { message: string } };
      const part = body.candidates?.[0]?.content.parts.find((p) => p.inlineData)?.inlineData;
      if (part) return samplesOf(Buffer.from(part.data, 'base64'), part.mimeType);
      const wait = Number(/retry in ([\d.]+)s/.exec(body.error?.message ?? '')?.[1] ?? 0);
      if (wait > 120) continue;
      process.stdout.write(`(${model}: waiting ${Math.ceil(wait || 25)} s) `);
      await sleep((wait || 25) * 1000);
    }
  }
  throw new Error('No text-to-speech model would read the narration');
}

/** Quiet runs of the take: [from, to] in samples */
function pausesOf(audio: Float32Array, rate: number): [number, number][] {
  const win = Math.round(rate / 100);
  const pauses: [number, number][] = [];
  let from = -1;
  for (let w = 0; w * win < audio.length; w++) {
    let e = 0;
    for (let i = w * win; i < Math.min(audio.length, (w + 1) * win); i++) e = Math.max(e, Math.abs(audio[i]!));
    if (e < 0.015) {
      if (from < 0) from = w * win;
    } else if (from >= 0) {
      if (from > 0) pauses.push([from, w * win]);
      from = -1;
    }
  }
  return pauses;
}

/**
 * A line's own pauses shortened to a breath: a speaker does not stop for half a second at a comma, and a pause inside
 * a sentence is what makes it sound broken
 */
function breathe(part: Float32Array, rate: number): Float32Array {
  const BREATH = Math.round(0.25 * rate);
  const keep: Float32Array[] = [];
  const win = Math.round(rate / 100);
  let from = 0;
  let quiet = -1;
  for (let w = 0; w * win < part.length; w++) {
    let e = 0;
    for (let i = w * win; i < Math.min(part.length, (w + 1) * win); i++) e = Math.max(e, Math.abs(part[i]!));
    if (e < 0.015) {
      if (quiet < 0) quiet = w * win;
    } else {
      // A quiet run inside the line, longer than a breath: keep its first and last half-breath only
      if (quiet > 0 && w * win - quiet > BREATH) {
        keep.push(part.slice(from, quiet + BREATH / 2));
        from = w * win - BREATH / 2;
      }
      quiet = -1;
    }
  }
  keep.push(part.slice(from));
  const out = new Float32Array(keep.reduce((n, k) => n + k.length, 0));
  let at = 0;
  for (const k of keep) {
    out.set(k, at);
    at += k.length;
  }
  return out;
}

/** Trimmed to its sound, with a breath either side, faded so it never clicks */
function clip(audio: Float32Array, rate: number, a: number, b: number): Float32Array {
  let s = a;
  let e = b;
  while (s < e && Math.abs(audio[s]!) < 0.01) s++;
  while (e > s && Math.abs(audio[e - 1]!) < 0.01) e--;
  const part = breathe(audio.slice(Math.max(a, s - Math.round(0.04 * rate)), Math.min(b, e + Math.round(0.15 * rate))), rate);
  const fin = Math.round(0.01 * rate);
  const fout = Math.round(0.04 * rate);
  for (let i = 0; i < fin && i < part.length; i++) part[i]! *= i / fin;
  for (let i = 0; i < fout && i < part.length; i++) part[part.length - 1 - i]! *= i / fout;
  return part;
}

/**
 * A take cut into its lines at its longest pauses, or null when the cut does not check out: a line's spoken length
 * must match its letters, against the take's own pace, to within 40%
 */
function cut(take: { audio: Float32Array; rate: number }, texts: string[]): Float32Array[] | null {
  if (texts.length === 1) return [clip(take.audio, take.rate, 0, take.audio.length)];
  const longest = pausesOf(take.audio, take.rate)
    .sort((x, y) => y[1] - y[0] - (x[1] - x[0]))
    .slice(0, texts.length - 1)
    .sort((x, y) => x[0] - y[0]);
  if (longest.length < texts.length - 1 || longest.some(([a, b]) => b - a < 0.35 * take.rate)) return null;
  const bounds = [0, ...longest.map(([a, b]) => Math.round((a + b) / 2)), take.audio.length];
  // Judged on the take as read, before its pauses are shortened
  const lengths = texts.map((_, k) => bounds[k + 1]! - bounds[k]!);
  const pace = lengths.reduce((s, n) => s + n, 0) / texts.reduce((s, t) => s + t.length, 0);
  if (lengths.some((n, k) => Math.abs(n / (texts[k]!.length * pace) - 1) > 0.5)) return null;
  return texts.map((_, k) => clip(take.audio, take.rate, bounds[k]!, bounds[k + 1]!));
}

/** Lines are read as paragraphs: a blank line between each */
const PARAGRAPH = String.fromCharCode(10).repeat(2);

// Scenes in batches of about a dozen lines, one request each: the free tier allows only a few requests a day
const batches: (typeof lines)[] = [];
for (const { scene } of SCRIPT) {
  const own = lines.filter((l) => l.key.startsWith(`${scene}-`));
  const last = batches.at(-1);
  if (last && last.length + own.length <= 14) last.push(...own);
  else batches.push([...own]);
}
for (const batch of batches) {
  if (!batch.some(stale)) continue;
  process.stdout.write(`${batch[0]!.key}…${batch.at(-1)!.key}: `);
  // Every take is kept, by its text and voice, so a cut can be tuned without asking for the take again
  const text = batch.map((l) => l.text).join(PARAGRAPH);
  const saved = `${takes}/${createHash('sha1').update(stamp + text).digest('hex').slice(0, 12)}.wav`;
  const take = existsSync(saved) ? samplesOf(readFileSync(saved), '') : await speak(text);
  if (!existsSync(saved)) writeFileSync(saved, wav(take.audio, take.rate));
  const parts = cut(take, batch.map((l) => l.text));
  if (!parts) {
    const p = pausesOf(take.audio, take.rate).map(([x, y]) => `${(x / take.rate).toFixed(1)}s+${((y - x) / take.rate).toFixed(2)}`);
    throw new Error(`The take of ${batch[0]!.key}…${batch.at(-1)!.key} (${(take.audio.length / take.rate).toFixed(1)} s, saved as ${saved}) would not cut into its ${batch.length} lines; its pauses: ${p.join(' ')}`);
  }
  parts.forEach((p, k) => writeFileSync(`${dir}/${batch[k]!.file}`, wav(p, take.rate)));
  console.log('done');
}

/** A recording's length, less the silence it leaves at its end */
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
console.log(`${lines.length} lines, ${total.toFixed(1)} s spoken`);
