import type { VoiceDown, VoiceEnded } from '@momentum/contract';
import type { WebSocket as Socket } from '@fastify/websocket';
import type { Sql } from '@momentum/kb';
import { CommandFeed, type StreamEvent } from './feed.ts';

interface StreamItem {
  id: number;
  kind: string;
  text: string;
  source?: string | null;
}

/** Words as the field takes them: a stretch begun with "question", which the command stream takes off, keeps it */
const typed = (kind: string | null | undefined, text: string) => (kind === 'question' ? `Question: ${text}` : text);

/**
 * Voice in Momentum: dictation. The user's devices stream their microphone through the harness to the command stream on
 * this PC, which transcribes it; the harness hands the text as heard so far and each closed stretch to the device
 * streaming, whose field takes it, and when the device stops, the words after the last stretch. Nothing said is acted
 * on: the user sends what the field holds. A cursor per sitting in the database hands each stretch on once, across
 * restarts: a sitting never seen before is followed from its end.
 */
export class Voice {
  private readonly feed: CommandFeed;
  private session: string | null = null;
  private lastItem = 0;
  private status = { connected: false, ready: false, source: 'none', muted: false, text: '' };
  private partial: { text: string; kind: string | null } | null = null;
  private readonly clients = new Map<string, (m: VoiceDown) => void>();
  /** The client whose device streams: the newest to open the audio socket, as on the command stream */
  private floor: string | null = null;

  constructor(
    private readonly sql: Sql,
    private readonly base: string,
    private readonly sources: string[],
  ) {
    this.feed = new CommandFeed(base, (e) => this.handle(e));
  }

  start(): void {
    this.feed.start();
  }

  stop(): void {
    this.feed.stop();
  }

  /** A control socket: status to every client, the text as heard and each closed stretch to the one streaming */
  connect(client: string, send: (m: VoiceDown) => void): () => void {
    this.clients.set(client, send);
    send({ type: 'status', ...this.status });
    if (this.floor === client && this.status.source === 'remote') send(this.partialDown());
    return () => {
      if (this.clients.get(client) === send) this.clients.delete(client);
    };
  }

  private broadcast(m: VoiceDown): void {
    for (const send of this.clients.values()) send(m);
  }

  private toFloor(m: VoiceDown): void {
    if (this.floor) this.clients.get(this.floor)?.(m);
  }

  private partialDown(): VoiceDown {
    return { type: 'partial', text: this.partial ? typed(this.partial.kind, this.partial.text) : null, kind: this.partial?.kind ?? null };
  }

  /**
   * An audio socket: the device's header and sample frames passed through unchanged to the command stream's
   * /ws/audio, which is loopback only; its replies come back the same way. Its `ended` carries the words heard after
   * the last closed stretch, taken from the stream's state and cleared there, so the PC's own microphone never sends
   * them on.
   */
  audio(client: string, socket: Socket): void {
    this.floor = client;
    const upstream = new WebSocket(`${this.http}/ws/audio`.replace(/^http/, 'ws'));
    upstream.binaryType = 'arraybuffer';
    const pending: (string | Buffer)[] = [];
    let clientGone = false;
    const forward = (data: string | Buffer) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
      else if (upstream.readyState === WebSocket.CONNECTING) pending.push(data);
    };
    const end = (m: VoiceEnded) => {
      if (clientGone) return;
      socket.send(JSON.stringify(m));
      socket.close();
    };
    socket.on('message', (data: Buffer, isBinary: boolean) => forward(isBinary ? data : data.toString('utf8')));
    socket.on('close', () => {
      clientGone = true;
      // The device stopped: the command stream decodes its last words, then answers and closes
      if (upstream.readyState === WebSocket.OPEN) upstream.send(JSON.stringify({ type: 'stop' }));
      else if (upstream.readyState === WebSocket.CONNECTING) pending.push(JSON.stringify({ type: 'stop' }));
    });
    upstream.onopen = () => {
      for (const data of pending.splice(0)) upstream.send(data);
    };
    let ended = false;
    upstream.onmessage = (m) => {
      const msg = JSON.parse(String(m.data)) as { type: string; reason?: string };
      if (msg.type !== 'ended') return void (clientGone || socket.send(String(m.data)));
      ended = true;
      const reason = msg.reason ?? 'stopped';
      // Another device took the stream: what is pending is its own
      if (reason === 'another source' || reason === 'not ready' || reason.startsWith('bad start')) return end({ type: 'ended', reason, text: '' });
      void this.takePending().then((text) => end({ type: 'ended', reason, text }));
    };
    upstream.onclose = () => {
      if (!ended) end({ type: 'ended', reason: 'the command stream closed', text: '' });
    };
    upstream.onerror = () => {
      ended = true;
      end({ type: 'ended', reason: 'no command stream', text: '' });
    };
  }

  /** The words after the last closed stretch, cleared on the command stream */
  private async takePending(): Promise<string> {
    try {
      const state = (await (await fetch(`${this.http}/api/state`)).json()) as { partial?: { text?: string; kind?: string } | null };
      await fetch(`${this.http}/api/clear`, { method: 'POST' });
      return state.partial?.text ? typed(state.partial.kind, state.partial.text) : '';
    } catch {
      return '';
    }
  }

  private get http(): string {
    return this.base.replace(/\/$/, '');
  }

  async handle(e: StreamEvent): Promise<void> {
    if (e.type === 'feed') {
      this.status.connected = e.connected === true;
      if (!this.status.connected) this.status.ready = false;
      return this.broadcast({ type: 'status', ...this.status });
    }
    if (e.type === 'snapshot') {
      const items = (e.items as StreamItem[] | undefined) ?? [];
      await this.bind(String(e.session), items);
      this.status = {
        connected: true,
        ready: e.ready === true,
        source: String(e.source ?? 'none'),
        muted: e.muted === true,
        text: String(e.status ?? ''),
      };
      this.partial = (e.partial as typeof this.partial) ?? null;
      this.broadcast({ type: 'status', ...this.status });
      // A resync or a resume: only what the cursor has not seen
      for (const item of items) await this.process(item);
      return;
    }
    if (e.session !== this.session) return;
    if (e.type === 'status') {
      Object.assign(this.status, { text: String(e.text ?? ''), ready: e.ready === true, source: String(e.source ?? this.status.source) });
      return this.broadcast({ type: 'status', ...this.status });
    }
    if (e.type === 'muted') {
      this.status.muted = e.muted === true;
      return this.broadcast({ type: 'status', ...this.status });
    }
    if (e.type === 'partial') {
      this.partial = (e.partial as typeof this.partial) ?? null;
      if (this.status.source === 'remote') this.toFloor(this.partialDown());
      return;
    }
    if (e.type === 'item') await this.process(e.item as StreamItem);
  }

  /** Follows a sitting: from its cursor when acted on before, otherwise from its end */
  private async bind(session: string, items: StreamItem[]): Promise<void> {
    if (session === this.session) return;
    this.session = session;
    const [row] = await this.sql<{ last_item: number }[]>`select last_item from harness.voice_cursor where session = ${session}`;
    if (row) {
      this.lastItem = row.last_item;
      return;
    }
    this.lastItem = Math.max(0, ...items.map((i) => i.id));
    await this.saveCursor();
  }

  private async saveCursor(): Promise<void> {
    await this.sql`insert into harness.voice_cursor (session, last_item) values (${this.session!}, ${this.lastItem})
      on conflict (session) do update set last_item = excluded.last_item, at = now()`;
  }

  /** Each item once, in order: the cursor moves before handing it on, so a crash never hands it on twice */
  private async process(item: StreamItem): Promise<void> {
    if (item.id <= this.lastItem) return;
    this.lastItem = item.id;
    await this.saveCursor();
    if (!this.sources.includes(item.source ?? '')) return;
    this.toFloor({ type: 'item', item: { id: item.id, kind: item.kind, text: typed(item.kind, item.text) } });
  }
}
