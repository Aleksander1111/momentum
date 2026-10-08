// A review by a model that watches and listens: uploads the rendered video to Gemini and asks for what feels or sounds
// unnatural, each with its time and a fix, written to out/review.json and out/review.md. Needs GEMINI_API_KEY in the
// environment; MOMENTUM_REVIEW_MODEL picks the model. Run: pnpm review [video]
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SCRIPT, CUTS } from '../src/Momentum.tsx';
import { FPS } from '../src/kit/motion.ts';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error('Set GEMINI_API_KEY to run the review');
// Tried in turn: a model out of quota or overloaded hands over to the next
const MODELS = (process.env.MOMENTUM_REVIEW_MODEL ?? 'gemini-pro-latest,gemini-3.5-flash,gemini-flash-latest,gemini-2.5-flash').split(',');
let MODEL = MODELS[0]!;
const API = 'https://generativelanguage.googleapis.com';
const video = process.argv[2] ?? fileURLToPath(new URL('../out/momentum.mp4', import.meta.url));
const out = (name: string) => fileURLToPath(new URL(`../out/${name}`, import.meta.url));

// Upload, resumable, then wait until the file is ready to be watched
const size = statSync(video).size;
const start = await fetch(`${API}/upload/v1beta/files`, {
  method: 'POST',
  headers: {
    'x-goog-api-key': KEY,
    'X-Goog-Upload-Protocol': 'resumable',
    'X-Goog-Upload-Command': 'start',
    'X-Goog-Upload-Header-Content-Length': String(size),
    'X-Goog-Upload-Header-Content-Type': 'video/mp4',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ file: { display_name: 'momentum-video' } }),
});
const uploadUrl = start.headers.get('x-goog-upload-url');
if (!uploadUrl) throw new Error(`Upload refused: ${start.status} ${await start.text()}`);
const uploaded = (await (
  await fetch(uploadUrl, { method: 'POST', headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: readFileSync(video) })
).json()) as { file: { name: string; uri: string; state: string } };
let file = uploaded.file;
while (file.state === 'PROCESSING') {
  await new Promise((r) => setTimeout(r, 5000));
  file = (await (await fetch(`${API}/v1beta/${file.name}`, { headers: { 'x-goog-api-key': KEY } })).json()) as typeof file;
}
if (file.state !== 'ACTIVE') throw new Error(`The video could not be processed: ${file.state}`);

// What the reviewer knows: who the video is for, its scenes and their times, its narration
const scenes = SCRIPT.map((s, i) => `- ${(CUTS[i]! / FPS).toFixed(1)} s: ${s.scene} — "${s.cues.map((c) => c.text).join(' ')}"`).join('\n');
const prompt = `You are a senior motion designer and sound editor reviewing a marketing video for Momentum, an open-source tool
for a person who runs many projects: everything that needs their decision comes to one feed, AI does the work, and
they approve with a swipe. The audience is that person, not developers.

Watch and listen to the whole video. Look hardest at three things a viewer has already complained about:
1. Strange slowdowns: motion that drags or decelerates for no visible reason, a scene that seems to stall.
2. Animations that are not executed correctly: elements that jump, pop, overlap, flicker, freeze, or end in the wrong
   place; a move that starts or stops abruptly.
3. The voice out of step with the picture: a line that describes something before it appears, after it has gone, or
   while something else is on screen.
Then list every other moment that feels or sounds unnatural to a viewer: the voice (pace,
intonation, pauses, emphasis, joins between sentences), the music (repetition, mood, level against the voice), the
motion (speed, easing, holds that look frozen or rushed, anything that moves mechanically), the edit (transitions,
scene length, how long text stays to be read), and anything hard to read or understand.

Its scenes start at:
${scenes}

Be specific and critical; skip praise. Answer as JSON only: an array of
{ "time": seconds, "scene": name, "kind": "slowdown" | "animation" | "sync" | "voice" | "music" | "motion" | "edit" | "text", "severity": 1-3, "issue": "...", "fix": "..." },
most severe first.`;

// The upload is not kept, whatever the review's outcome
let count = 0;
try {
  type Reply = { candidates?: { content: { parts: { text: string }[] } }[]; error?: { message: string } };
  let body: Reply = {};
  for (const model of MODELS) {
    MODEL = model;
    const res = await fetch(`${API}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ file_data: { mime_type: 'video/mp4', file_uri: file.uri } }, { text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    });
    body = (await res.json()) as Reply;
    if (body.candidates) break;
    console.log(`${model}: ${body.error?.message.split('
')[0] ?? res.status}`);
  }
  if (!body.candidates) throw new Error('No model could review the video');
  const notes = JSON.parse(body.candidates[0]!.content.parts.map((p) => p.text).join('')) as { time: number; scene: string; kind: string; severity: number; issue: string; fix: string }[];
  writeFileSync(out('review.json'), JSON.stringify(notes, null, 2) + '\n');
  writeFileSync(
    out('review.md'),
    `# Review by ${MODEL}\n\n| Time | Scene | Kind | Sev. | Issue | Fix |\n|---|---|---|---|---|---|\n` +
      notes.map((n) => `| ${n.time.toFixed(1)} | ${n.scene} | ${n.kind} | ${n.severity} | ${n.issue} | ${n.fix} |`).join('\n') +
      '\n',
  );
  count = notes.length;
} finally {
  await fetch(`${API}/v1beta/${file.name}`, { method: 'DELETE', headers: { 'x-goog-api-key': KEY } });
}
console.log(`${count} notes in out/review.md`);
