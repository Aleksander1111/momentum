import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { VoiceDown, type VoiceItem, type VoiceOutcome, type VoiceTarget } from '@momentum/contract';
import { openSocket } from './socket';
import { startMic, type Mic } from './mic';

/**
 * Voice: this device's microphone streams to the PC, which transcribes it; the harness acts on each spoken item where
 * the mic that was started sends it (its target) and tells this app what came of it. One control socket per app
 * carries the target up and the status, the text as heard so far and the outcomes down.
 */

type Status = Extract<VoiceDown, { type: 'status' }>;
type Handler = (outcome: VoiceOutcome, item: VoiceItem) => void;

interface State {
  status: Status | null;
  /** The text as heard so far, for the owner of the mic */
  partial: string | null;
  listening: boolean;
  /** Which mic was started last: its outcomes and partial text are its own */
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
let target: VoiceTarget | null = null;
let mic: Mic | null = null;

function sendTarget() {
  if (control?.readyState === WebSocket.OPEN) control.send(JSON.stringify({ type: 'target', target }));
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
    sendTarget();
  };
  socket.onmessage = (m) => {
    const parsed = VoiceDown.safeParse(JSON.parse(String(m.data)));
    if (!parsed.success) return;
    const msg = parsed.data;
    if (msg.type === 'status') set({ status: msg });
    else if (msg.type === 'partial') set({ partial: msg.text });
    else {
      set({ partial: null });
      if (state.owner) handlers.get(state.owner)?.(msg.outcome, msg.item);
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
  void connect();
  return () => {
    listeners.delete(l);
    if (listeners.size > 0) return;
    // No screen listens any more: the socket goes until one does
    if (retry) clearTimeout(retry);
    retry = null;
    control?.close();
  };
}

async function stopMic() {
  const m = mic;
  mic = null;
  set({ listening: false });
  await m?.stop();
}

/**
 * One mic: started, it declares its target and owns what is heard until another mic starts. `target` is re-sent while
 * it owns the floor (a chat's context chips change, a run opens). Stops when its screen goes.
 */
export function useVoice(voiceTarget: VoiceTarget | null, onOutcome: Handler) {
  const id = useRef(Symbol('mic')).current;
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  const own = s.owner === id;
  const key = JSON.stringify(voiceTarget);

  useEffect(() => {
    handlers.set(id, onOutcome);
  });
  useEffect(() => () => void handlers.delete(id), [id]);
  useEffect(() => {
    if (state.owner !== id) return;
    target = voiceTarget;
    sendTarget();
  }, [key]);
  // The screen goes: its mic stops; items heard before still land where it sent them
  useFocusEffect(
    useCallback(
      () => () => {
        if (state.owner === id && state.listening) void stopMic();
      },
      [id],
    ),
  );

  const start = useCallback(async () => {
    if (!voiceTarget) return;
    if (state.listening) await stopMic();
    target = voiceTarget;
    sendTarget();
    set({ owner: id, partial: null, listening: true });
    try {
      mic = await startMic((reason) => {
        if (mic) void stopMic();
        if (reason) console.warn(`voice: ${reason}`);
      });
    } catch (e) {
      set({ listening: false });
      console.warn('voice:', e);
    }
  }, [key]);

  const stop = useCallback(() => {
    if (state.owner === id) void stopMic();
  }, [id]);

  return {
    available: !!s.status?.connected && s.status.ready,
    listening: own && s.listening,
    partial: own ? s.partial : null,
    start,
    stop,
  };
}
