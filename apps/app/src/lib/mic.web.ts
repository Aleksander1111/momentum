import { openSocket } from './socket';

export interface Mic {
  /** Stops recording; the PC decodes the last words, then the socket closes */
  stop(): Promise<void>;
}

/** Hands each block of samples to the page; nothing is processed here, the PC does it all */
const WORKLET = `registerProcessor('tap', class extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
});`;

/**
 * Web: the microphone as recorded, float32 at the device rate, streamed to the PC through the harness. The browser's
 * own echo cancellation, noise suppression and gain control are off: every step after recording runs on the PC.
 * `onEnded` is called when the PC ends the stream (another device, idle, muted) or it fails.
 */
export async function startMic(onEnded: (reason?: string) => void): Promise<Mic> {
  const media = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const source = ctx.createMediaStreamSource(media);
  const tap = new AudioWorkletNode(ctx, 'tap');
  source.connect(tap);

  const socket = await openSocket('/voice/audio');
  socket.binaryType = 'arraybuffer';
  const ready = new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error('no voice socket'));
  });
  let ended = false;
  const closed = new Promise<void>((resolve) => {
    socket.onclose = () => {
      release();
      if (!ended) onEnded('the voice socket closed');
      resolve();
    };
  });
  socket.onmessage = (m) => {
    const msg = JSON.parse(String(m.data)) as { type: string; reason?: string };
    if (msg.type === 'ended' && !ended) {
      ended = true;
      onEnded(msg.reason === 'stopped' ? undefined : msg.reason);
    }
  };

  // About 40 ms per frame
  let pending: Float32Array[] = [];
  let count = 0;
  const frame = Math.round(ctx.sampleRate / 25);
  tap.port.onmessage = (e: MessageEvent<Float32Array>) => {
    pending.push(e.data);
    count += e.data.length;
    if (count < frame || socket.readyState !== WebSocket.OPEN) return;
    const out = new Float32Array(count);
    let at = 0;
    for (const p of pending) {
      out.set(p, at);
      at += p.length;
    }
    pending = [];
    count = 0;
    socket.send(out.buffer);
  };

  let released = false;
  function release() {
    if (released) return;
    released = true;
    tap.port.onmessage = null;
    source.disconnect();
    tap.disconnect();
    media.getTracks().forEach((t) => t.stop());
    void ctx.close();
  }

  await ready;
  socket.send(JSON.stringify({ type: 'start', rate: ctx.sampleRate, channels: 1, format: 'f32le', client: 'momentum web' }));

  return {
    async stop() {
      release();
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'stop' }));
      ended = true;
      await Promise.race([closed, new Promise((r) => setTimeout(r, 15_000))]);
      if (socket.readyState === WebSocket.OPEN) socket.close();
    },
  };
}
