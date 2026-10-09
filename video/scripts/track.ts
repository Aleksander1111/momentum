// The narration as the cut plays it, with no music: renders the Momentum composition's sound alone to out/voice.wav,
// so scripts/listen.py --track can hear where every line really falls in the video.
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { fileURLToPath } from 'node:url';

const serveUrl = await bundle({ entryPoint: fileURLToPath(new URL('../src/index.ts', import.meta.url)) });
const inputProps = { music: false };
const composition = await selectComposition({ serveUrl, id: 'Momentum', inputProps });
await renderMedia({ serveUrl, composition, codec: 'wav', inputProps, outputLocation: fileURLToPath(new URL('../out/voice.wav', import.meta.url)) });
console.log(`out/voice.wav: ${(composition.durationInFrames / composition.fps).toFixed(1)} s`);
