import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import type { FeedResponse } from '@momentum/contract';
import { api, NetworkError } from './api';
import { withoutItem } from './feed';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Retry only while the API is unreachable; with the client offline the retry pauses until it is back. */
const retry = (_count: number, error: unknown) => error instanceof NetworkError;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: WEEK, staleTime: 5_000, retry },
    mutations: { retry, retryDelay: 1_000 },
  },
});

export type ApproveVars = { workspace: string; path: string; timeSpentMs: number };
export type SendBackVars = ApproveVars & { comment: string };

export const REACTIONS = ['approve', 'sendBack'] as const;

function dropFromFeed(v: { workspace: string; path: string }) {
  queryClient.setQueryData<FeedResponse>(['feed'], (old) => (old ? withoutItem(old, v) : old));
}

// Defaults by key so reactions queued offline (and persisted) can resume after a restart.
queryClient.setMutationDefaults(['approve'], {
  mutationFn: (v: ApproveVars) => api.approve(v.path, { workspace: v.workspace, timeSpentMs: v.timeSpentMs }),
  onSuccess: (_d: unknown, v: ApproveVars) => {
    dropFromFeed(v);
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
  },
});

queryClient.setMutationDefaults(['sendBack'], {
  mutationFn: (v: SendBackVars) =>
    api.sendBack(v.path, { workspace: v.workspace, comment: v.comment, timeSpentMs: v.timeSpentMs }),
  onSuccess: (_d: unknown, v: SendBackVars) => {
    dropFromFeed(v);
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
    void queryClient.invalidateQueries({ queryKey: ['chats'] });
  },
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createAsyncStoragePersister({ storage: AsyncStorage, key: 'momentum.cache', throttleTime: 1_000 }),
  maxAge: WEEK,
  buster: '2',
  dehydrateOptions: {
    // Keep the last good data even when the latest poll failed, so it stays available offline.
    shouldDehydrateQuery: (q) => q.state.data !== undefined && q.queryKey[0] !== 'search',
    shouldDehydrateMutation: (m) => m.state.isPaused,
  },
};
