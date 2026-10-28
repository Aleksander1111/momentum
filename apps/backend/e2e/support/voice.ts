import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';

/**
 * A stand-in for the command stream of voice-commands on this machine: the app's mic streams audio into it through the
 * back-end, and the scenario says what was heard: the text as heard so far, and stretches closed into items, the way
 * the real stream decodes speech. A device that stops is answered with `ended`, its last words left pending in the
 * state for the harness to take and clear.
 */
export class FakeCommandStream {
  private server: Server;
  private feed = new WebSocketServer({ noServer: true });
  private audio = new WebSocketServer({ noServer: true });
  private items: { id: number; kind: string; text: string; source: string }[] = [];
  private seq = 0;
  /** Every item event sent, with its sequence number, for replays */
  private sent: { seq: number; item: { id: number; kind: string; text: string; source: string } }[] = [];
  /** The words heard after the last closed stretch */
  private pending: { kind: string; text: string } | null = null;
  /** How often a follower fetched the state afresh: once per hole it saw, and once per device that stopped */
  resyncs = 0;
  /** How often the pending words were cleared */
  cleared = 0;
  readonly session = `e2e-${Date.now()}`;
  /** Audio sockets opened by a mic in the app, open now, and ever */
  listening = 0;
  opened = 0;

  constructor() {
    this.server = createServer((req, res) => {
      if (req.url === '/api/state') {
        this.resyncs++;
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify(this.snapshot()));
      }
      if (req.url === '/api/clear' && req.method === 'POST') {
        this.cleared++;
        this.hear(null);
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ ok: true }));
      }
      res.statusCode = 404;
      res.end();
    });
    this.server.on('upgrade', (req, socket, head) => {
      const target = req.url === '/ws' ? this.feed : req.url === '/ws/audio' ? this.audio : null;
      if (!target) return socket.destroy();
      target.handleUpgrade(req, socket, head, (ws) => target.emit('connection', ws));
    });
    this.feed.on('connection', (ws: WebSocket) => ws.send(JSON.stringify(this.snapshot())));
    this.audio.on('connection', (ws: WebSocket) => {
      this.listening++;
      this.opened++;
      ws.on('message', (data, binary) => {
        if (binary) return;
        const msg = JSON.parse(String(data)) as { type: string };
        if (msg.type === 'start') ws.send(JSON.stringify({ type: 'accepted', session: this.session }));
        if (msg.type === 'stop') {
          ws.send(JSON.stringify({ type: 'ended', reason: 'stopped' }));
          ws.close();
        }
      });
      ws.on('close', () => this.listening--);
    });
  }

  private snapshot() {
    return {
      type: 'snapshot',
      session: this.session,
      seq: this.seq,
      ready: true,
      source: 'remote',
      muted: false,
      status: 'listening',
      items: this.items,
      partial: this.pending && { ...this.pending, closing: false },
    };
  }

  async listen(): Promise<number> {
    await new Promise<void>((ok) => this.server.listen(0, '127.0.0.1', ok));
    return (this.server.address() as AddressInfo).port;
  }

  /** The text as heard so far, not closed yet: a "question" said first makes it a question, its keyword taken off */
  hear(text: string | null, kind: 'command' | 'question' = 'command'): void {
    this.pending = text ? { kind, text } : null;
    this.send(JSON.stringify({ type: 'partial', session: this.session, partial: this.pending && { ...this.pending, closing: false } }));
  }

  /**
   * A stretch closed by "go", "cancel" or a pause: an item, typed into the field holding the mic. With `hole`, the
   * event skips a sequence number, as a lost message does: a follower sees the hole and resyncs from the state.
   */
  say(text: string, kind: 'command' | 'question' | 'cancelled' = 'command', opts: { hole?: boolean } = {}): void {
    const item = { id: this.items.length + 1, kind, text, source: 'remote' };
    this.items.push(item);
    this.pending = null;
    if (opts.hole) this.seq++;
    this.sent.push({ seq: ++this.seq, item });
    this.send(JSON.stringify({ type: 'item', session: this.session, seq: this.seq, item }));
  }

  /** Sends an item's event again, with the sequence number it had: a duplicate, as a flaky connection delivers */
  replay(id: number): void {
    const sent = this.sent.find((s) => s.item.id === id);
    if (!sent) throw new Error(`No item ${id} was said`);
    this.send(JSON.stringify({ type: 'item', session: this.session, seq: sent.seq, item: sent.item }));
  }

  /** Closes every feed connection: a follower reconnects and gets a fresh snapshot */
  dropFeed(): void {
    for (const ws of this.feed.clients) ws.terminate();
  }

  private send(event: string): void {
    for (const ws of this.feed.clients) ws.send(event);
  }

  async close(): Promise<void> {
    for (const ws of [...this.feed.clients, ...this.audio.clients]) ws.terminate();
    await new Promise<void>((ok) => this.server.close(() => ok()));
  }
}
