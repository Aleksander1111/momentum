// Runs one of the Python speech scripts in the environment of the transcription project next door, which has the
// models they need: F5-TTS for scripts/clone.py, Whisper and TitaNet for scripts/listen.py. MOMENTUM_SPEECH points
// elsewhere. Run: tsx scripts/speech.ts <script.py> [args]
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [script, ...args] = process.argv.slice(2);
if (!script) throw new Error('Name a script: clone.py or listen.py');
const root = process.env.MOMENTUM_SPEECH ?? fileURLToPath(new URL('../../../transcription', import.meta.url));
const python = `${root}/${script === 'clone.py' ? '.venv-tts' : '.venv'}/Scripts/python.exe`;
const run = spawnSync(python, [fileURLToPath(new URL(script, import.meta.url)), ...args], { stdio: ['ignore', 'inherit', 'ignore'] });
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;
