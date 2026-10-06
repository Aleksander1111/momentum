import { send } from '../lib/http.js';
import type { Router } from '../router.js';

/** GET /health: the process is up; what version runs */
export function healthRoutes(router: Router, version: string): void {
  router.on('GET', '/health', ({ res }) => send(res, 200, { ok: true, version }));
}
