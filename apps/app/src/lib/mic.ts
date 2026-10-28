import { PermissionsAndroid } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { openSocket } from './socket';

export interface Mic {
  /** Stops recording; the PC decodes the last words, ends the stream, then the socket closes */
  stop(): Promise<void>;
}

/** How the stream ended: why, unless it was stopped here, and the words heard after the last closed stretch */
export interface MicEnd {
  reason?: string;
  text: string;
}

interface VoiceCapture {
  start(rate: number): void;
  stop(): void;
  addListener(event: 'onAudio', listener: (e: { data: string }) => void): { remove(): void };
}

/** The native recorder of modules/voice-capture; absent from a build made before it */
const Native = requireOptionalNativeModule<VoiceCapture>('VoiceCapture');

/** 16-bit mono at 16 kHz: what the PC decodes at, so nothing is resampled on the way */
const RATE = 16000;

function bytesOf(base64: string): ArrayBuffer {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/**
 * Android: the microphone as recorded, streamed to the PC through the harness, which does every step after recording.
 * `onEnded` is called once, when the stream ends: stopped here, ended by the PC (another device, idle, muted) or failed.
 */
export async function startMic(onEnded: (end: MicEnd) => void): Promise<Mic> {
  if (!Native) throw new Error('this build has no voice capture');
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('microphone permission denied');

  const socket = await openSocket('/voice/audio');
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error('no voice socket'));
  });
  let ended = false;
  const finish = (end: MicEnd) => {
    if (ended) return;
    ended = true;
    onEnded(end);
  };
  const closed = new Promise<void>((resolve) => {
    socket.onclose = () => {
      release();
      finish({ reason: 'the voice socket closed', text: '' });
      resolve();
    };
  });
  socket.onmessage = (m) => {
    const msg = JSON.parse(String(m.data)) as { type: string; reason?: string; text?: string };
    if (msg.type === 'ended') finish({ reason: msg.reason === 'stopped' ? undefined : msg.reason, text: msg.text ?? '' });
  };
  socket.send(JSON.stringify({ type: 'start', rate: RATE, channels: 1, format: 's16le', client: 'momentum android' }));

  const sub = Native.addListener('onAudio', (e) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(bytesOf(e.data));
  });
  Native.start(RATE);

  let released = false;
  function release() {
    if (released) return;
    released = true;
    Native!.stop();
    sub.remove();
  }

  return {
    async stop() {
      release();
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'stop' }));
      await Promise.race([closed, new Promise((r) => setTimeout(r, 15_000))]);
      if (socket.readyState === WebSocket.OPEN) socket.close();
    },
  };
}
