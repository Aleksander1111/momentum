/**
 * Following the command stream of voice-commands (its STREAM.md is the contract), ported from its reference client:
 * the first event after every (re)connect is a snapshot to replace what is held; a hole in `seq` fetches a fresh
 * snapshot instead, so the consumer never sees one; an event already seen is not handed on twice; losing the
 * connection is reported once per outage.
 */

/** Events with no `seq`: dropped first, superseded by the next */
const LOSSY = new Set(['partial', 'stats']);

export interface StreamEvent {
  type: string;
  session?: string;
  seq?: number;
  [key: string]: unknown;
}

/** Per message: deliver it, skip it (seen), or resync (a hole). Pure. */
export class SequenceTracker {
  seq: number | null = null;

  accept(message: StreamEvent): 'deliver' | 'skip' | 'resync' {
    if (message.type === 'snapshot') {
      this.seq = Number(message.seq ?? 0);
      return 'deliver';
    }
    if (LOSSY.has(message.type) || message.seq === undefined) return 'deliver';
    if (this.seq === null) return 'resync';
    const seq = Number(message.seq);
    if (seq <= this.seq) return 'skip';
    if (seq !== this.seq + 1) return 'resync';
    this.seq = seq;
    return 'deliver';
  }
}

/** One connection at a time, reconnecting; events are handed on in order, each after the one before was handled */
export class CommandFeed {
  readonly tracker = new SequenceTracker();
  private socket: WebSocket | null = null;
  private stopped = false;
  private down = false;
  private chain: Promise<void> = Promise.resolve();

  constructor(
    readonly base: string,
    private readonly onEvent: (e: StreamEvent) => Promise<void> | void,
    private readonly reconnectMs = 2000,
  ) {}

  get wsUrl(): string {
    return `${this.base.replace(/^http/, 'ws').replace(/\/$/, '')}/ws`;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.socket?.close();
    this.socket = null;
  }

  private hand(e: StreamEvent): void {
    this.chain = this.chain.then(() => this.onEvent(e)).catch((err) => console.error('voice: handling a stream event:', err));
  }

  private connect(): void {
    if (this.stopped) return;
    const socket = new WebSocket(this.wsUrl);
    this.socket = socket;
    let lost = false;
    const lose = (detail: string) => {
      if (lost) return;
      lost = true;
      if (this.socket === socket) this.socket = null;
      if (!this.down) {
        this.down = true;
        this.hand({ type: 'feed', connected: false, detail });
      }
      if (!this.stopped) setTimeout(() => this.connect(), this.reconnectMs);
    };
    socket.onopen = () => {
      this.down = false;
      this.hand({ type: 'feed', connected: true });
    };
    socket.onmessage = (m) => {
      const message = JSON.parse(String(m.data)) as StreamEvent;
      const verdict = this.tracker.accept(message);
      if (verdict === 'skip') return;
      if (verdict === 'deliver') return this.hand(message);
      // A hole: what follows waits for the fresh snapshot, so nothing is handed on out of order
      this.chain = this.chain.then(async () => {
        const snapshot = (await (await fetch(`${this.base}/api/state`)).json()) as StreamEvent;
        this.tracker.accept(snapshot);
        await this.onEvent(snapshot);
      }).catch((err) => console.error('voice: resync:', err));
    };
    socket.onclose = () => lose('the command stream closed');
    socket.onerror = () => lose(`no command stream at ${this.base}`);
  }
}
