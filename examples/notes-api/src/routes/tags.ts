import { tagCounts } from '../domain/tag.js';
import { send } from '../lib/http.js';
import type { Router } from '../router.js';
import type { Store } from '../store/store.js';

/** GET /tags: the tags in use with how many notes carry each */
export function tagRoutes(router: Router, store: Store): void {
  router.on('GET', '/tags', ({ res }) => send(res, 200, tagCounts(store.all())));
}
