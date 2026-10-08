// Checks the narration's recordings against the script: every line's clip is transcribed by Gemini in one request and
// compared word for word with its text, so a clip that starts or ends in the middle of a sentence, or holds a word of
// the line before or after, is caught. Also lists any pause inside a clip longer than a breath.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TIMING } from '../src/kit/voice.tsx';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error('Set GEMINI_API_KEY to check the narration');
const MODELS = (process.env.MOMENTUM_REVIEW_MODEL ?? 'gemini-3.5-flash,gemini-flash-latest,gemini-2.5-flash').split(',');
const dir = fileURLToPath(new URL('../public/voice', import.meta.url));
const entries = Object.entries(TIMING);

// Pauses inside a clip: a run quieter than speech for over half a second, not at its ends
const long: string[] = [];
for (const [key, t] of entries) {
  const b = readFileSync(`${dir}/${t.file}`);
  const rate = b.readUInt32LE(24);
  const n = b.readUInt32LE(40) / 2;
  const win = Math.round(rate / 100);
  let quiet = 0;
  let spoke = false;
  for (let w = 0; w * win < n; w++) {
    let e = 0;
    for (let i = w * win; i < Math.min(n, (w + 1) * win); i++) e = Math.max(e, Math.abs(b.readInt16LE(44 + i * 2)));
    if (e < 500) quiet++;
    else {
      if (spoke && quiet > 50) long.push(`${key}: ${(quiet / 100).toFixed(1)} s pause at ${(((w - quiet) * win) / rate).toFixed(1)} s`);
      spoke = true;
      quiet = 0;
    }
  }
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
const parts = entries.flatMap(([key, t]) => [{ text: `Clip ${key}:` }, { inline_data: { mime_type: 'audio/wav', data: readFileSync(`${dir}/${t.file}`).toString('base64') } }]);
let transcripts: Record<string, string> | null = null;
for (const model of MODELS) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [...parts, { text: `Transcribe each of the ${entries.length} clips exactly as spoken, word for word, in order. Answer as JSON only: an array of ${entries.length} strings, one per clip.` }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    }),
  });
  const body = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[]; error?: { message: string } };
  if (body.candidates) {
    const list = JSON.parse(body.candidates[0]!.content.parts.map((p) => p.text).join('')) as string[];
    transcripts = Object.fromEntries(entries.map(([key], i) => [key, list[i] ?? '']));
    break;
  }
  console.log(`${model}: ${body.error?.message.split(String.fromCharCode(10))[0]}`);
}
if (!transcripts) throw new Error('No model could transcribe the narration');

const wrong = entries.filter(([key, t]) => words(transcripts![key] ?? '').join(' ') !== words(t.text).join(' '));
for (const [key, t] of wrong) console.log(`${key}\n  script: ${t.text}\n  heard:  ${transcripts[key] ?? '(nothing)'}`);
for (const p of long) console.log(p);
console.log(`${entries.length - wrong.length}/${entries.length} clips say exactly their line; ${long.length} long pauses inside a clip`);
