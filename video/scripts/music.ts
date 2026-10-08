// The video's music, synthesised here so it ships with the source under the repository's licence: no sample, no
// download. A warm pad, bass, a plucked arpeggio and a light beat at 96 BPM, a riser into every scene and a soft hit as
// it starts; sparse under the opening, full from the layers on, down to the pad under the logo. Written as a WAV that
// the composition plays.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FPS } from '../src/kit/motion.ts';
import { CUTS, MOMENTUM_FRAMES } from '../src/Momentum.tsx';

const RATE = 44100;
const LENGTH = MOMENTUM_FRAMES / FPS;
const N = Math.ceil(LENGTH * RATE);
const L = new Float32Array(N);
const R = new Float32Array(N);

const BPM = 96;
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;
const cut = (i: number) => CUTS[i]! / FPS;
/** The opening, before the layers: sparse; the close, under the logo: the pad alone */
const DROP = cut(1);
const OUTRO = LENGTH - 9;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
// Two bars a chord: Fmaj7, Am7, Cmaj7, G6 — open and unresolved, so it can loop under three minutes
const CHORDS = [
  [53, 57, 60, 64],
  [57, 60, 64, 67],
  [48, 52, 55, 59],
  [55, 59, 62, 64],
];
const chordAt = (t: number) => CHORDS[Math.floor(t / (2 * BAR)) % CHORDS.length]!;

/** Adds a mono voice at time `t0`, panned between -1 and 1 */
function add(t0: number, samples: Float32Array, gain: number, pan = 0) {
  const start = Math.round(t0 * RATE);
  const l = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const r = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < samples.length; i++) {
    const k = start + i;
    if (k < 0 || k >= N) continue;
    L[k]! += samples[i]! * l;
    R[k]! += samples[i]! * r;
  }
}

/** A low-passed voice: `wave(phase)` through a one-pole filter, shaped by `env(t)` */
function voice(seconds: number, f: number, wave: (p: number) => number, env: (t: number) => number, cutoff = 2000) {
  const out = new Float32Array(Math.round(seconds * RATE));
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  let y = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    y += a * (wave((f * t) % 1) - y);
    out[i] = y * env(t);
  }
  return out;
}
const saw = (p: number) => 2 * p - 1;
const sine = (p: number) => Math.sin(2 * Math.PI * p);
const tri = (p: number) => 1 - 4 * Math.abs(p - 0.5);

// The pad: each chord's notes as detuned saws, slow in and out, through the whole video
for (let t = 0; t < LENGTH; t += 2 * BAR) {
  const len = 2 * BAR + 1.2;
  const level = t < DROP ? 0.8 : 1;
  chordAt(t).forEach((m, k) => {
    for (const detune of [-0.08, 0.08]) {
      const env = (x: number) => Math.min(1, x / 1.2) * Math.min(1, (len - x) / 1.2);
      add(t, voice(len, hz(m + detune), saw, env, 900), 0.028 * level, (k - 1.5) / 2 + detune * 4);
    }
  });
}

// The bass: the chord's root on every beat from the drop, the last bars held
for (let t = DROP; t < OUTRO; t += BEAT) {
  const root = chordAt(t)[0]! - 12;
  add(t, voice(BEAT * 0.95, hz(root), tri, (x) => Math.min(1, x / 0.01) * Math.exp(-x * 2.4), 400), 0.16);
}

// The arpeggio: the chord's notes an octave up in eighths, plucked; it starts in the opening, quietly
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
for (let t = 2 * BAR, i = 0; t < OUTRO + BAR; t += BEAT / 2, i++) {
  const m = chordAt(t)[ARP[i % ARP.length]!]! + 12;
  const level = t < DROP ? 0.6 : 0.75;
  add(t, voice(0.6, hz(m), (p) => 0.6 * sine(p) + 0.4 * tri(p), (x) => Math.min(1, x / 0.004) * Math.exp(-x * 7), 3500), 0.07 * level, i % 2 ? 0.35 : -0.35);
}

// The beat: a soft kick on one and three, a closed hat on the off-beats, from the drop to the outro
const kick = new Float32Array(Math.round(0.35 * RATE)).map((_, i) => {
  const x = i / RATE;
  // From 105 Hz down to 45 Hz in a few hundredths of a second
  return Math.sin(2 * Math.PI * (45 * x + 2 * (1 - Math.exp(-x * 30)))) * Math.exp(-x * 9);
});
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const hat = (() => {
  const out = new Float32Array(Math.round(0.05 * RATE));
  let prev = 0;
  for (let i = 0; i < out.length; i++) {
    const n = noise();
    out[i] = (n - prev) * Math.exp((-i / RATE) * 90);
    prev = n;
  }
  return out;
})();
for (let t = DROP; t < OUTRO; t += BEAT) {
  const beat = Math.round((t - DROP) / BEAT);
  if (beat % 2 === 0) add(t, kick, 0.32);
  add(t + BEAT / 2, hat, 0.05, 0.2);
}

// Into every scene: a noise riser over the bar before it, then a low hit as it starts
for (let i = 1; i < CUTS.length; i++) {
  const at = cut(i);
  const len = 1.6;
  const riser = new Float32Array(Math.round(len * RATE));
  let y = 0;
  for (let k = 0; k < riser.length; k++) {
    const x = k / riser.length;
    const a = 1 - Math.exp((-2 * Math.PI * (300 + 5000 * x * x)) / RATE);
    y += a * (noise() - y);
    riser[k] = y * x * x;
  }
  add(at - len, riser, i === 1 ? 0.22 : 0.12);
  add(at, voice(1.8, 41, sine, (x) => Math.min(1, x / 0.005) * Math.exp(-x * 2.2), 200), i === 1 ? 0.5 : 0.3);
}

// The master: in and out, and a soft limit
// Loudness from the body of the track, not its loudest hit: the hits are what the soft limit rounds off
let sum = 0;
let count = 0;
for (let i = Math.round(DROP * RATE); i < Math.round(OUTRO * RATE); i += 7) {
  sum += L[i]! * L[i]! + R[i]! * R[i]!;
  count += 2;
}
const gain = 0.2 / Math.sqrt(sum / count);
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0);
out.writeUInt32LE(36 + N * 4, 4);
out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22);
out.writeUInt32LE(RATE, 24);
out.writeUInt32LE(RATE * 4, 28);
out.writeUInt16LE(4, 32);
out.writeUInt16LE(16, 34);
out.write('data', 36);
out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const t = i / RATE;
  const fade = Math.min(1, t / 1.5) * Math.min(1, (LENGTH - t) / 4);
  for (const [c, ch] of [L, R].entries()) {
    const v = Math.tanh(ch[i]! * gain) * 0.9 * fade;
    out.writeInt16LE(Math.round(v * 32767), 44 + i * 4 + c * 2);
  }
}
const dir = fileURLToPath(new URL('../public', import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/music.wav`, out);
console.log(`music.wav: ${LENGTH.toFixed(1)} s, ${CUTS.length} scenes`);
