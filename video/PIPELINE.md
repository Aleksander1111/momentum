# Video pipeline

How the Momentum video is made, and how to make the next one.

## Stack

| Part | Technology |
|---|---|
| Picture | Remotion 4 (React 19, TypeScript): every frame is code, rendered by headless Chromium |
| App on screen | The app redrawn as React components (`src/kit/app.tsx`, `desktop.tsx`), never screen recordings |
| Transitions | `@remotion/transitions`, custom presentations (`src/kit/transitions.tsx`) |
| Voice | F5-TTS cloned from ~11 s of Gemini's Sulafat voice (`assets/sulafat-reference.wav`), run locally on the GPU |
| Voice checks | Whisper large-v3 (words, pauses) and NVIDIA TitaNet (same speaker), via `faster-whisper` and NeMo |
| Music | Synthesised in code, ducked under every line (`scripts/music.ts`) |
| Frame analysis | `@remotion/renderer` + `sharp` (motion, sharpness) |
| Optional review | Gemini watches the video and lists issues (`scripts/review.ts`, needs `GEMINI_API_KEY`) |

The speech models live in the `transcription` project next door (`.venv` for Whisper and TitaNet, `.venv-tts` for F5-TTS); `scripts/speech.ts` runs them, and `MOMENTUM_SPEECH` points elsewhere.

## How it is built

1. **Story first.** One scene per slide, for the person who decides: no developer words. Each scene is `src/scenes/<Name>.tsx`, in order in `src/Momentum.tsx`.
2. **Beats and lines.** A scene has `FRAMES` (its own time) and `CUES`: `{ at, hold, text }`, one spoken line per beat. Animations are keyed to named beat constants, never to loose numbers.
3. **The voice sets the tempo.** Each line is recorded, its length goes to `src/voice.json`, and a beat too short for its line is held at a moment where the picture is still (`voiceDwells`). A beat with no still moment fails validation: lengthen the beat instead.
4. **Two clocks.** `useSceneFrame` (held for lines) drives the story; `useAmbientFrame` (real time) drives what moves for ever: pulses, spinners, dashes, bobs. `useDrift` is a camera drift on real time.

## Run

```bash
pnpm --filter @momentum/video voice      # record every changed line, keep the best take
pnpm --filter @momentum/video check      # measure everything below; must pass
pnpm --filter @momentum/video music
pnpm --filter @momentum/video render Momentum out/momentum.mp4
```

`pnpm --filter @momentum/video studio` previews in the browser; `still <Composition> out/x.png --frame=N` renders one frame. Each scene is its own composition, and `Unheld-<Scene>` shows it without holds.

## What `pnpm check` measures

| Step | Script | Fails on |
|---|---|---|
| Motion | `stillness.ts` | (measures each scene's motion frame by frame for the holds) |
| Timing | `validate.ts` | Two lines at once, under 0.5 s between lines, a line running into the next beat or past the handover, a hold where the picture moves, a move cut off by the transition |
| Layout | `audit.ts` | Text cut by the frame or a container, running off its card, covered by something; text shown for less than 0.5 s plus a third of a second a word |
| Flow | `pauses.ts` | A frame that jumps against its neighbours; still and silent for over 2 s |
| Flicker | `flicker.ts` | A frame sharper or softer than both neighbours |
| Voice | `listen.py` | A line not heard word for word, a pause inside a sentence, a voice unlike the reference or the other lines |
| Track | `track.ts` + `listen.py --track` | In the rendered narration: a line not heard in its slot, or starting off its place, or sound where no line is |

Deliberate exceptions are listed in the scripts with their reason (`DELIBERATE`, `INTENDED`). Add one only when the effect is the design.

## Rules learned the hard way

- **Measure, never eyeball thumbnails.** Every complaint so far was measurable; add a check before fixing.
- **One voice.** Separate requests to a hosted TTS drift in timbre. Clone once, take several seeds per line, keep the take that passes Whisper and TitaNet.
- **Never slow motion down to fit a line.** Freeze only a picture that is already still (change under 0.12 per pixel for ±6 frames), or give the beat more frames.
- **A 3D turn never sits at exactly 0°** (`turned()`); no whole-frame drift or scale: both make single frames flicker.
- **Let every animation finish** and every text stay long enough to read before the next beat replaces it.
- **Keep what is on screen**: elements introduced in a scene stay until its end unless the story removes them.
- **Change only what was asked.** Fixing one issue must not move or restyle anything else; list any side change before making it.
- **After a scene change:** `pnpm check`, then look at stills of every changed spot.
