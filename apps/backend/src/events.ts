import { EventEmitter } from 'node:events';

export interface Events {
  /** A transaction of a run passed or failed the guard */
  transaction: [{ workspace: string; runId: string; branch: string; paths: string[]; valid: boolean }];
  /** An implementable entity was approved with nothing implementing it */
  entity_ahead: [{ workspace: string; path: string }];
  /** The artifact under an entity changed; summarization rewrites the card */
  artifact_ahead: [{ workspace: string; path: string }];
  /** An implementation run finished on its branch; validation runs next */
  implementation_finished: [{ workspace: string; runId: string; branch: string; targetPath: string | null }];
  /** Trigger entities of a workspace changed on its main line */
  triggers_changed: [{ workspace: string }];
  /** A definition entity was approved in the harness workspace */
  definition_approved: [{ path: string }];
  /** A run ended; the orchestrator may start queued runs */
  run_ended: [{ workspace: string; runId: string }];
  /** The feed shrank: loops paused at the feed size may continue */
  feed_changed: [];
}

export type Bus = EventEmitter<Events>;

export function createBus(): Bus {
  const bus = new EventEmitter<Events>();
  bus.setMaxListeners(50);
  return bus;
}
