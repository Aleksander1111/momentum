import type { AutomationName, ContextItem, VoiceDown, VoiceOutcome, VoiceTarget } from '@momentum/contract';
import type { WebSocket as Socket } from '@fastify/websocket';
import type { Sql } from '@momentum/kb';
import { CommandFeed, type StreamEvent } from './feed.ts';

/** What the voice router does with a spoken item: the harness's own handlers */
export interface VoiceActions {
  createChat(workspace: string, text: string, targetPath?: string, context?: ContextItem[]): Promise<{ runId: string }>;
  postMessage(id: string, text: string, context?: ContextItem[]): Promise<void>;
  runAutomation(workspace: string, automation: AutomationName, prompt?: string): Promise<{ runId: string }>;
  entity(workspace: string, path: string): Promise<{ title: string }>;
}

interface StreamItem {
  id: number;
  kind: string;
  text: string;
  source?: string | null;
}

/** Lower case, no punctuation, single spaces, as the command stream's grammar normalises */
export const normalise = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');

// The two shapes said anywhere, ported from markdown-voice; everything else goes where the screen sends it
const INTERVIEW = /^interview (?<topic>.+)$/;
const END_INTERVIEW = /^(stop|end|finish|close)( the)? interview$/;

/**
 * Voice in Momentum: the user's devices stream their microphone through the harness to the command stream on this PC,
 * which transcribes it; the harness follows the stream and acts on each item once, in order, where the screen the
 * user is on sends it (its target). A cursor per sitting in the database makes "once" hold across restarts: a sitting
 * never seen before is followed from its end, so nothing said before the harness listened is acted on now.
 */
export class Voice {
  private readonly feed: CommandFeed;
  private session: string | null = null;
  private lastItem = 0;
  private status = { connected: false, ready: false, source: 'none', muted: false, text: '' };
  private partial: { text: string; kind: string | null } | null = null;
  private readonly clients = new Map<string, (m: VoiceDown) => void>();
  /** The latest target of each client, kept after it disconnects so an item heard after that still lands */
  private readonly targets = new Map<string, VoiceTarget | null>();
  /** The client whose device streams: the newest to open the audio socket, as on the command stream */
  private floor: string | null = null;

  constructor(
    private readonly sql: Sql,
    private readonly actions: VoiceActions,
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

  /** A control socket: status to every client, the partial text and outcomes to the one streaming */
  connect(client: string, send: (m: VoiceDown) => void): () => void {
    this.clients.set(client, send);
    send({ type: 'status', ...this.status });
    if (this.floor === client && this.status.source === 'remote') send({ type: 'partial', text: this.partial?.text ?? null, kind: this.partial?.kind ?? null });
    return () => {
      if (this.clients.get(client) === send) this.clients.delete(client);
    };
  }

  setTarget(client: string, target: VoiceTarget | null): void {
    this.targets.set(client, target);
  }

  private broadcast(m: VoiceDown): void {
    for (const send of this.clients.values()) send(m);
  }

  private toFloor(m: VoiceDown): void {
    if (this.floor) this.clients.get(this.floor)?.(m);
  }

  /**
   * An audio socket: the device's header and sample frames passed through unchanged to the command stream's
   * /ws/audio, which is loopback only; its replies (accepted, ended) come back the same way
   */
  audio(client: string, socket: Socket): void {
    this.floor = client;
    const upstream = new WebSocket(`${this.base.replace(/^http/, 'ws').replace(/\/$/, '')}/ws/audio`);
    upstream.binaryType = 'arraybuffer';
    const pending: (string | Buffer)[] = [];
    let clientGone = false;
    const forward = (data: string | Buffer) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
      else if (upstream.readyState === WebSocket.CONNECTING) pending.push(data);
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
    upstream.onmessage = (m) => {
      if (!clientGone) socket.send(String(m.data));
    };
    upstream.onclose = () => {
      if (!clientGone) socket.close();
    };
    upstream.onerror = () => {
      if (clientGone) return;
      socket.send(JSON.stringify({ type: 'ended', reason: 'no command stream' }));
      socket.close();
    };
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
      if (this.status.source === 'remote') this.toFloor({ type: 'partial', text: this.partial?.text ?? null, kind: this.partial?.kind ?? null });
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

  /** Each item once, in order: the cursor moves before acting, so a crash never acts twice */
  private async process(item: StreamItem): Promise<void> {
    if (item.id <= this.lastItem) return;
    this.lastItem = item.id;
    await this.saveCursor();
    if (!this.sources.includes(item.source ?? '')) return;
    const outcome = await this.route(item).catch((e: Error): VoiceOutcome => ({ kind: 'failed', detail: e.message }));
    this.toFloor({ type: 'item', item: { id: item.id, kind: item.kind, text: item.text }, outcome });
  }

  private async route(item: StreamItem): Promise<VoiceOutcome> {
    if (item.kind !== 'command' && item.kind !== 'question') return { kind: 'ignored', detail: item.kind };
    const target = this.floor ? (this.targets.get(this.floor) ?? null) : null;
    const said = normalise(item.text);
    const started = INTERVIEW.exec(said);
    if (started && target) {
      const workspace = target.workspace;
      const { runId } = await this.actions.runAutomation(workspace, 'interview', `Interview: ${started.groups!.topic}`);
      return { kind: 'chat', workspace, runId, created: true };
    }
    if (END_INTERVIEW.test(said) && target?.kind !== 'interview') return { kind: 'ignored', detail: 'no interview open' };
    if (!target) return { kind: 'ignored', detail: 'nothing on screen takes voice' };
    const workspace = target.workspace;
    switch (target.kind) {
      case 'search':
        return { kind: 'search', workspace, text: item.text };
      case 'chat': {
        if (target.runId) {
          await this.actions.postMessage(target.runId, item.text, target.context);
          this.targets.set(this.floor!, { ...target, context: [] });
          return { kind: 'chat', workspace, runId: target.runId };
        }
        const { runId } = await this.actions.createChat(workspace, item.text, undefined, target.context);
        // The next item goes on in this chat, even before the app has opened it
        this.targets.set(this.floor!, { ...target, runId, context: [] });
        return { kind: 'chat', workspace, runId, created: true };
      }
      case 'entity': {
        // A command changes the entity, as a send back does; a question asks about it with its card as context
        if (item.kind === 'command') {
          const { runId } = await this.actions.createChat(workspace, item.text, target.path);
          return { kind: 'chat', workspace, runId, created: true };
        }
        const { title } = await this.actions.entity(workspace, target.path);
        const { runId } = await this.actions.createChat(workspace, item.text, undefined, [{ workspace, path: target.path, title, heading: [] }]);
        return { kind: 'chat', workspace, runId, created: true };
      }
      case 'interview': {
        await this.actions.postMessage(target.runId, item.kind === 'question' ? `Question: ${item.text}` : item.text);
        return { kind: 'chat', workspace, runId: target.runId };
      }
    }
  }
}
