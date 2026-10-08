// Records the narration: every line of every scene, spoken by the text-to-speech voice installed on this machine,
// into public/voice/, and each line's length into src/voice.json, which the scenes hold their beats by. A line whose
// text has not changed since it was recorded is kept.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FPS } from '../src/kit/motion.ts';
import { lineKey, TIMING } from '../src/kit/voice.tsx';
import { SCRIPT } from '../src/Momentum.tsx';

const VOICE = process.env.MOMENTUM_VOICE ?? 'Microsoft Hazel Desktop';
/** Words a minute against the voice's default: a little slower, so the lines land */
const RATE = Number(process.env.MOMENTUM_VOICE_RATE ?? -1);

const dir = fileURLToPath(new URL('../public/voice', import.meta.url));
const timingFile = fileURLToPath(new URL('../src/voice.json', import.meta.url));
mkdirSync(dir, { recursive: true });

const lines = SCRIPT.flatMap(({ scene, cues }) => cues.map((cue, i) => ({ key: lineKey(scene, i), text: cue.text, file: `${lineKey(scene, i)}.wav` })));
const todo = lines.filter((l) => TIMING[l.key]?.text !== l.text || !existsSync(`${dir}/${l.file}`));

if (todo.length) {
  // One PowerShell for every line: System.Speech writes each as 44.1 kHz mono
  const list = `${dir}/lines.json`;
  writeFileSync(list, JSON.stringify(todo.map((l) => ({ text: l.text, path: `${dir}/${l.file}` }))));
  const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('${VOICE}')
$s.Rate = ${RATE}
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($l in (Get-Content -Raw '${list}' | ConvertFrom-Json)) {
  $s.SetOutputToWaveFile($l.path, $format)
  $s.Speak($l.text)
}
$s.SetOutputToNull()`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' });
}

/** A recording's length, from its WAV header, less the silence the voice leaves at its end */
function framesOf(path: string): number {
  const b = readFileSync(path);
  const data = b.indexOf('data');
  const size = b.readUInt32LE(data + 4);
  let end = size / 2;
  while (end > 0 && Math.abs(b.readInt16LE(data + 8 + (end - 1) * 2)) < 300) end--;
  return Math.ceil((end / 44100) * FPS);
}

const timing = Object.fromEntries(lines.map((l) => [l.key, { file: l.file, frames: framesOf(`${dir}/${l.file}`), text: l.text }]));
writeFileSync(timingFile, JSON.stringify(timing, null, 2) + '\n');
const total = Object.values(timing).reduce((s, t) => s + t.frames, 0) / FPS;
console.log(`${lines.length} lines (${todo.length} recorded), ${total.toFixed(1)} s spoken`);
