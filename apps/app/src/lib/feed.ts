import type { FeedResponse } from '@momentum/contract';

/** The feed without one item, for reactions in flight and reactions that succeeded; the counters wait for the next poll. */
export function withoutItem(feed: FeedResponse, v: { workspace: string; path: string }): FeedResponse {
  return { ...feed, items: feed.items.filter((i) => !(i.workspace === v.workspace && i.path === v.path)) };
}
