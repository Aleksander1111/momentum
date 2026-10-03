import { createServer, type Server, type Socket } from 'node:net';

/**
 * Where the Claude Code processes of a scenario without real runs send their requests: it takes every connection and
 * never answers, so a run starts and stays running, using nothing, until it is killed or the scenario ends.
 */
export class BlackHole {
  private server: Server;
  private sockets = new Set<Socket>();
  /** Requests the runs tried to send */
  connections = 0;

  constructor() {
    this.server = createServer((s) => {
      this.connections++;
      this.sockets.add(s);
      s.on('error', () => {});
      s.on('close', () => this.sockets.delete(s));
    });
  }

  async listen(): Promise<string> {
    await new Promise<void>((ok) => this.server.listen(0, '127.0.0.1', ok));
    return `http://127.0.0.1:${(this.server.address() as { port: number }).port}`;
  }

  async close(): Promise<void> {
    for (const s of this.sockets) s.destroy();
    await new Promise<void>((ok) => this.server.close(() => ok()));
  }
}
