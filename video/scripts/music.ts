// The video's music, synthesised here so it ships with the source under the repository's licence: no sample, no
// download. One section per act of the story, each with its own chords, rhythm and instruments, so three and a half
// minutes never loop the same bars; no noise sweeps, a soft low swell only where an act begins. It makes room for the
// narration, dipping under every line. Written as a WAV the composition plays.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FPS } from '../src/kit/motion.ts';
import { CUTS, MOMENTUM_FRAMES, SPOKEN } from '../src/Momentum.tsx';

const RATE = 44100;
const LENGTH = MOMENTUM_FRAMES / FPS;
const N = Math.ceil(LENGTH * RATE);
const L = new Float32Array(N);
const R = new Float32Array(N);

const BPM = 92;
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;
const at = (scene: number) => (scene < CUTS.length ? CUTS[scene]! / FPS : LENGTH);
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

type Drums = 'none' | 'pulse' | 'light' | 'drive';
interface Section {
  from: number;
  to: number;
  /** Two bars a chord, as MIDI notes, root first */
  chords: number[][];
  arp: number[] | null;
  /** Notes per beat of the arpeggio */
  speed: number;
  drums: Drums;
  bass: 'none' | 'held' | 'beats' | 'eighths';
  bells: boolean;
  pad: number;
}

// The acts, at the scenes they start on (see Momentum.tsx): the problem, the answer, attention, understanding,
// implementation, the close
const SECTIONS: Section[] = [
  { from: 0, to: at(1), chords: [[45, 52, 57, 60, 64], [41, 48, 53, 57, 64]], arp: null, speed: 1, drums: 'pulse', bass: 'none', bells: false, pad: 0.8 },
  { from: at(1), to: at(2), chords: [[41, 53, 57, 60, 64], [40, 52, 55, 60, 64], [45, 52, 57, 60, 64], [43, 50, 55, 59, 62]], arp: [0, 2, 1, 3, 2, 4, 3, 2], speed: 2, drums: 'none', bass: 'held', bells: false, pad: 1 },
  { from: at(2), to: at(4), chords: [[41, 53, 57, 60, 64], [45, 52, 57, 60, 67], [48, 52, 55, 59, 64], [43, 50, 55, 59, 64]], arp: [0, 1, 2, 3, 4, 3, 2, 1], speed: 2, drums: 'light', bass: 'beats', bells: false, pad: 0.9 },
  { from: at(4), to: at(7), chords: [[50, 57, 60, 64, 65], [46, 53, 57, 62, 65], [41, 53, 57, 60, 64], [48, 55, 60, 62, 64]], arp: [0, 2, 4, 2], speed: 1, drums: 'none', bass: 'held', bells: true, pad: 1 },
  { from: at(7), to: at(9), chords: [[48, 55, 60, 64, 67], [47, 55, 59, 62, 67], [45, 52, 57, 60, 64], [41, 53, 57, 60, 65]], arp: [0, 1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 3, 2, 1, 2, 3], speed: 4, drums: 'drive', bass: 'eighths', bells: false, pad: 0.85 },
  { from: at(9), to: LENGTH, chords: [[41, 53, 57, 60, 64], [43, 50, 55, 59, 62], [45, 52, 57, 60, 64], [48, 55, 60, 64, 67]], arp: [0, 2, 3, 4], speed: 1, drums: 'light', bass: 'held', bells: true, pad: 1 },
];
/** The last bars: the pad and bells alone, under the logo */
const QUIET = LENGTH - 10;

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

/** `wave(phase)` through a one-pole low-pass, shaped by `env(t)` */
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
const pluck = (x: number, decay: number) => Math.min(1, x / 0.004) * Math.exp(-x * decay);

let seed = 11;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const kick = new Float32Array(Math.round(0.35 * RATE)).map((_, i) => {
  const x = i / RATE;
  // From 105 Hz down to 45 Hz in a few hundredths of a second
  return Math.sin(2 * Math.PI * (45 * x + 2 * (1 - Math.exp(-x * 30)))) * Math.exp(-x * 9);
});
const hat = (() => {
  const out = new Float32Array(Math.round(0.04 * RATE));
  let prev = 0;
  for (let i = 0; i < out.length; i++) {
    const n = noise();
    out[i] = (n - prev) * Math.exp((-i / RATE) * 110);
    prev = n;
  }
  return out;
})();

for (const s of SECTIONS) {
  const chordAt = (t: number) => s.chords[Math.floor((t - s.from) / (2 * BAR)) % s.chords.length]!;
  const passAt = (t: number) => Math.floor((t - s.from) / (2 * BAR * s.chords.length));
  const quiet = (t: number) => t >= QUIET;
  // The pad: the chord's upper notes as detuned saws, slow in and out, a little brighter each pass of the chords
  for (let t = s.from; t < s.to; t += 2 * BAR) {
    const len = Math.min(2 * BAR, s.to - t) + 1.5;
    chordAt(t)
      .slice(1)
      .forEach((m, k) => {
        for (const detune of [-0.07, 0.07]) {
          const env = (x: number) => Math.min(1, x / 1.4) * Math.min(1, (len - x) / 1.4);
          add(t, voice(len, hz(m + detune), saw, env, 700 + 250 * Math.min(passAt(t), 3)), 0.024 * s.pad, (k - 1.5) / 2.5 + detune * 3);
        }
      });
  }
  // The bass
  if (s.bass !== 'none') {
    const step = s.bass === 'eighths' ? BEAT / 2 : s.bass === 'beats' ? BEAT : 2 * BAR;
    for (let t = s.from; t < s.to; t += step) {
      if (quiet(t)) continue;
      const root = chordAt(t)[0]! - 12;
      const len = s.bass === 'held' ? Math.min(2 * BAR, s.to - t) : step * 0.9;
      const env = s.bass === 'held' ? (x: number) => Math.min(1, x / 0.3) * Math.min(1, (len - x) / 0.5) : (x: number) => Math.min(1, x / 0.01) * Math.exp(-x * 3);
      add(t, voice(len, hz(root), tri, env, 380), s.bass === 'held' ? 0.12 : 0.15);
    }
  }
  // The arpeggio: its pattern over the chord, an octave higher every other pass, as plucks
  if (s.arp) {
    const step = BEAT / s.speed;
    for (let t = s.from, i = 0; t < s.to; t += step, i++) {
      if (quiet(t)) continue;
      const chord = chordAt(t);
      const m = chord[s.arp[i % s.arp.length]! % chord.length]! + 12 + (passAt(t) % 2) * 12;
      const accent = i % s.arp.length === 0 ? 1.25 : 1;
      add(t, voice(0.7, hz(m), (p) => 0.65 * sine(p) + 0.35 * tri(p), (x) => pluck(x, s.speed > 2 ? 9 : 6), 3200), 0.05 * accent, i % 2 ? 0.3 : -0.3);
    }
  }
  // Bells: a slow motif of the chord's top notes, every other bar
  if (s.bells) {
    const motif = [4, 3, 2, 3];
    for (let t = s.from + BAR, i = 0; t < s.to; t += 2 * BAR, i++) {
      const chord = chordAt(t);
      [0, 1.5, 2].forEach((beat, k) => {
        const m = chord[motif[(i + k) % motif.length]! % chord.length]! + 24;
        const bell = voice(2.4, hz(m), (p) => sine(p) + 0.3 * sine((p * 2.76) % 1), (x) => pluck(x, 1.6), 6000);
        add(t + beat * BEAT, bell, 0.035, k === 1 ? 0.4 : -0.2);
      });
    }
  }
  // Drums: a heartbeat under the problem, light time under attention, a drive under the implementation
  if (s.drums !== 'none') {
    for (let t = s.from, b = 0; t < s.to - 0.01; t += BEAT, b++) {
      if (quiet(t)) continue;
      if (s.drums === 'pulse') {
        // Two soft beats a bar, like a heart
        if (b % 4 === 0) {
          add(t, kick, 0.18);
          add(t + 0.28, kick, 0.12);
        }
        continue;
      }
      if (s.drums === 'drive' || b % 2 === 0) add(t, kick, s.drums === 'drive' ? 0.24 : 0.2);
      add(t + BEAT / 2, hat, s.drums === 'drive' ? 0.035 : 0.022, 0.25);
    }
  }
}

// Each act builds, peaks two thirds of the way in and settles into the next, so the music follows the story
for (const s of SECTIONS) {
  const a = Math.round(s.from * RATE);
  const b = Math.min(N, Math.round(s.to * RATE));
  for (let i = a; i < b; i++) {
    const x = (i - a) / (b - a);
    const u = x < 0.66 ? (0.5 * x) / 0.66 : 0.5 + (0.5 * (x - 0.66)) / 0.34;
    const arc = 0.72 + 0.4 * Math.sin(Math.PI * u);
    L[i]! *= arc;
    R[i]! *= arc;
  }
}

// Where an act begins, after the opening: a soft low swell, felt more than heard
for (const s of SECTIONS.slice(1)) {
  add(s.from - 0.6, voice(3, 36.7, sine, (x) => Math.sin(Math.min(1, x / 3) * Math.PI) ** 2, 160), 0.22);
}

// The narration's room: the music dips by about 7 dB under every line
const duck = new Float32Array(N).fill(1);
for (const { from, seconds } of SPOKEN) {
  const a = Math.round((from - 0.25) * RATE);
  const b = Math.round((from + seconds + 0.3) * RATE);
  const ramp = Math.round(0.25 * RATE);
  for (let i = Math.max(0, a); i < Math.min(N, b + ramp); i++) {
    const v = i < a + ramp ? 1 - (0.55 * (i - a)) / ramp : i < b ? 0.45 : 0.45 + (0.55 * (i - b)) / ramp;
    duck[i] = Math.min(duck[i]!, v);
  }
}

// The master: loudness from the body of the track, a soft limit, in and out
let sum = 0;
let count = 0;
for (let i = Math.round(at(1) * RATE); i < Math.round(QUIET * RATE); i += 7) {
  sum += L[i]! * L[i]! + R[i]! * R[i]!;
  count += 2;
}
const gain = 0.17 / Math.sqrt(sum / count);
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
  const fade = Math.min(1, t / 2) * Math.min(1, (LENGTH - t) / 5);
  for (const [c, ch] of [L, R].entries()) {
    const v = Math.tanh(ch[i]! * gain) * 0.9 * fade * duck[i]!;
    out.writeInt16LE(Math.round(v * 32767), 44 + i * 4 + c * 2);
  }
}
const dir = fileURLToPath(new URL('../public', import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/music.wav`, out);
console.log(`music.wav: ${LENGTH.toFixed(1)} s, ${SECTIONS.length} sections, ducked under ${SPOKEN.length} lines`);
