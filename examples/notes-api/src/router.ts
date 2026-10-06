import type { IncomingMessage, ServerResponse } from 'node:http';

export interface Request {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
}

export type Handler = (r: Request) => Promise<void> | void;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Route {
  method: Method;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

/** Routes by method and path pattern, `/notes/:id` style; the first match handles the request */
export class Router {
  private routes: Route[] = [];

  on(method: Method, path: string, handler: Handler): this {
    const keys: string[] = [];
    const source = path.replace(/:([a-zA-Z]+)/g, (_, key: string) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.routes.push({ method, pattern: new RegExp(`^${source}/?$`), keys, handler });
    return this;
  }

  /** The handler and its params for a request; null when no route matches */
  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.pattern.exec(pathname);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1] ?? '')]));
      return { handler: r.handler, params };
    }
    return null;
  }

  /** Whether some route has the path, under another method */
  knows(pathname: string): boolean {
    return this.routes.some((r) => r.pattern.test(pathname));
  }
}
