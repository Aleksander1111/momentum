import { EventEmitter } from 'node:events';

/** A file moved on the main line; unchanged when its content moved as it was */
export interface Moved {
  from: string;
  to: string;
  unchanged: boolean;
}

export interface Events {
  /** A transaction of a run passed or failed the guard and landed on the main line */
  transaction: [
    {
      workspace: string;
      runId: string;
      automation: string;
      commit: string | null;
      /** The commit message */
      message: string;
      paths: string[];
      /** Entities the run removed, with the titles they had */
      removed: { path: string; title: string }[];
      valid: boolean;
      issues: number;
      conflicts: string[];
    },
  ];
  /** An implementable entity was approved with nothing implementing it */
  entity_ahead: [{ workspace: string; path: string }];
  /** Artifacts changed on the main line under these entities; one summarization run rewrites their cards */
  artifact_ahead: [{ workspace: string; entities: { path: string; artifacts: string[] }[]; added: string[]; deleted: string[]; moved: Moved[] }];
  /** An implementation run finished and its work landed on the main line; validation runs next */
  implementation_finished: [{ workspace: string; runId: string; targetPath: string | null }];
  /** Trigger entities of a workspace changed on its main line */
  triggers_changed: [{ workspace: string }];
  /** A definition entity or its files changed on the harness main line */
  definition_changed: [{ path: string }];
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
