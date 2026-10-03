import { router } from 'expo-router';

/** Opens a run's conversation: beside the chat list on wide screens, on its own page otherwise */
export function openRun(runId: string, wide: boolean) {
  if (wide) router.navigate({ pathname: '/chat', params: { run: runId } });
  else router.push({ pathname: '/chat/[runId]', params: { runId } });
}
