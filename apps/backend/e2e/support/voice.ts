import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';

/**
 * A stand-in for the command stream of voice-commands on this machine: the app's mic streams audio into it through the
 * back-end, and the scenario says what was heard as items, the way the real stream decodes speech into commands and
 * questions.
 */
export class FakeCommandStream {
  private server: Server;
  private feed = new WebSocketServer({ noServer: true });
  private audio = new WebSocketServer({ noServer: true });
  private items: { id: number; kind: string; text: string; source: string }[] = [];
  private seq = 0;
  readonly session = `e2e-${Date.now()}`;
  /** Audio sockets opened by a mic in the app, open now, and ever */
  listening = 0;
  opened = 0;

  constructor() {
    this.server = createServer((req, res) => {
      if (req.url === '/api/state') {
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify(this.snapshot()));
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
        if (!binary && JSON.parse(String(data)).type === 'stop') ws.close();
      });
      ws.on('close', () => this.listening--);
    });
  }

  private snapshot() {
    return { type: 'snapshot', session: this.session, seq: this.seq, ready: true, source: 'remote', muted: false, status: 'listening', items: this.items };
  }

  async listen(): Promise<number> {
    await new Promise<void>((ok) => this.server.listen(0, '127.0.0.1', ok));
    return (this.server.address() as AddressInfo).port;
  }

  /** Something heard: a command or a question, acted on where the screen holding the mic sends it */
  say(text: string, kind: 'command' | 'question' = 'command'): void {
    const item = { id: this.items.length + 1, kind, text, source: 'remote' };
    this.items.push(item);
    const event = JSON.stringify({ type: 'item', session: this.session, seq: ++this.seq, item });
    for (const ws of this.feed.clients) ws.send(event);
  }

  async close(): Promise<void> {
    for (const ws of [...this.feed.clients, ...this.audio.clients]) ws.terminate();
    await new Promise<void>((ok) => this.server.close(() => ok()));
  }
}
