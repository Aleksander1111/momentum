// Records the narration with Kokoro, an open-weight text-to-speech model (Apache-2.0) that runs on any OS: every line
// of every scene into public/voice/, and each line's length into src/voice.json, which the scenes hold their beats by.
// A line whose text has not changed since it was recorded is kept. The model (about 330 MB) is fetched from Hugging
// Face on the first run and cached.
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
const stamp = `${VOICE}@${SPEED}`;
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

if (todo.length) {
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp32', device: 'cpu' });
  for (const l of todo) {
    const audio = await tts.generate(l.text, { voice: VOICE, speed: SPEED });
    writeFileSync(`${dir}/${l.file}`, wav(audio.audio, audio.sampling_rate));
    process.stdout.write('.');
  }
  process.stdout.write('\n');
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
