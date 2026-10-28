import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { VoiceDown } from '@momentum/contract';
import { openSocket } from './socket';
import { startMic, type Mic, type MicEnd } from './mic';
import { snapshot } from './snapshot';

/**
 * Dictation: this device's microphone streams to the PC, which transcribes it, and the field whose mic was started takes
 * the text; nothing is sent until the user sends it. One control socket per app carries the status, the text as heard
 * so far and each closed stretch down; the audio socket ends with the words heard after the last stretch.
 */

type Status = Extract<VoiceDown, { type: 'status' }>;
/** A field taking what was heard */
type Handler = (text: string) => void;

interface State {
  status: Status | null;
  /** The text as heard so far, for the owner of the mic */
  partial: string | null;
  listening: boolean;
  /** Which mic was started last: what is heard is its own */
  owner: symbol | null;
}

let state: State = { status: null, partial: null, listening: false, owner: null };
const listeners = new Set<() => void>();
const handlers = new Map<symbol, Handler>();
const set = (change: Partial<State>) => {
  state = { ...state, ...change };
  listeners.forEach((l) => l());
};

let control: WebSocket | null = null;
/** The one connection being opened: every screen asking meanwhile shares it */
let connecting: Promise<void> | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
/** How long until the next try: doubled after every one that failed, back to the first once a socket opens */
const FIRST_RETRY_MS = 3000;
const LAST_RETRY_MS = 60_000;
let retryMs = FIRST_RETRY_MS;
let mic: Mic | null = null;

/** What was heard goes to the field of the mic started last; a stretch cancelled by voice goes nowhere */
function deliver(text: string) {
  const t = text.trim();
  if (t && state.owner) handlers.get(state.owner)?.(t);
}

function connect(): Promise<void> {
  if (control || listeners.size === 0) return Promise.resolve();
  connecting ??= open().finally(() => (connecting = null));
  return connecting;
}

/** The next try, while a screen still listens */
function reconnect() {
  if (retry || listeners.size === 0) return;
  retry = setTimeout(() => {
    retry = null;
    void connect();
  }, retryMs);
  retryMs = Math.min(retryMs * 2, LAST_RETRY_MS);
}

async function open() {
  let socket: WebSocket;
  try {
    socket = await openSocket('/voice');
  } catch {
    reconnect();
    return;
  }
  // Every screen went while it opened
  if (listeners.size === 0) return void socket.close();
  control = socket;
  socket.onopen = () => {
    retryMs = FIRST_RETRY_MS;
  };
  socket.onmessage = (m) => {
    const parsed = VoiceDown.safeParse(JSON.parse(String(m.data)));
    if (!parsed.success) return;
    const msg = parsed.data;
    if (msg.type === 'status') set({ status: msg });
    else if (msg.type === 'partial') set({ partial: msg.text });
    else {
      set({ partial: null });
      if (msg.item.kind !== 'cancelled') deliver(msg.item.text);
    }
  };
  socket.onclose = (e) => {
    if (control === socket) control = null;
    set({ status: state.status && { ...state.status, connected: false } });
    // Voice is off on the harness: asking every few seconds changes nothing, so it asks once a minute
    if (e.code === 1011) retryMs = LAST_RETRY_MS;
    reconnect();
  };
}

function subscribe(l: () => void) {
  listeners.add(l);
  // The exported app has no PC to hear it: the mic stays dimmed and no socket opens
  if (!snapshot) void connect();
  return () => {
    listeners.delete(l);
    if (listeners.size > 0) return;
    // No screen listens any more: the socket goes until one does
    if (retry) clearTimeout(retry);
    retry = null;
    control?.close();
  };
}

/** The stream ended: its last words go to the field, and the mic is off */
function ended({ reason, text }: MicEnd) {
  mic = null;
  deliver(text);
  set({ listening: false, partial: null });
  if (reason) console.warn(`voice: ${reason}`);
}

async function stopMic() {
  const m = mic;
  if (!m) return set({ listening: false, partial: null });
  await m.stop();
}

/**
 * One mic, typing into its field: started, it owns what is heard until another mic starts; `onText` adds each stretch
 * heard to the field. While it listens `partial` is the text heard so far, after what the field holds. Stops when its
 * screen goes.
 */
export function useDictation(onText: Handler) {
  const id = useRef(Symbol('mic')).current;
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  const own = s.owner === id;

  useEffect(() => {
    handlers.set(id, onText);
  });
  useEffect(() => () => void handlers.delete(id), [id]);
  // The screen goes: its mic stops; the words heard last still reach its field while it is mounted
  useFocusEffect(
    useCallback(
      () => () => {
        if (state.owner === id && state.listening) void stopMic();
      },
      [id],
    ),
  );

  const start = useCallback(async () => {
    if (state.listening) await stopMic();
    set({ owner: id, partial: null, listening: true });
    try {
      const m = await startMic(ended);
      mic = m;
      // Stopped while the microphone was being opened
      if (!state.listening || state.owner !== id) await m.stop();
    } catch (e) {
      set({ listening: false });
      console.warn('voice:', e);
    }
  }, [id]);

  const stop = useCallback(() => {
    if (state.owner === id) void stopMic();
  }, [id]);

  return {
    available: !!s.status?.connected && s.status.ready,
    listening: own && s.listening,
    partial: own && s.listening ? s.partial : null,
    start,
    stop,
  };
}

/** What a field holds with what was heard after it, one space between */
export const withHeard = (text: string, heard: string | null) => (!heard ? text : !text.trim() ? heard : `${text}${/\s$/.test(text) ? '' : ' '}${heard}`);
