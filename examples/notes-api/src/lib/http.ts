import type { IncomingMessage, ServerResponse } from 'node:http';

/** An error the client caused, answered with its status */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function send(res: ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  const text = type === 'application/json' ? JSON.stringify(body) : String(body);
  res.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

/** The request body as JSON; 400 when it is not JSON, 413 when it is larger than a megabyte */
export async function readJson(req: IncomingMessage, limit = 1024 * 1024): Promise<unknown> {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > limit) throw new HttpError(413, 'body too large');
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'body must be JSON');
  }
}
