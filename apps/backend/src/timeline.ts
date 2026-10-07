import type {
  EntityState,
  EntityStates,
  Risk,
  RunStatus,
  RunTrigger,
  TimelineActor,
  TimelineEvent,
  TimelineFacts,
  TimelineKind,
  TimelineQuery,
  TimelineResponse,
} from '@momentum/contract';
import type { Sql } from '@momentum/kb';
import type { Bus } from './events.ts';

export interface NewEvent {
  workspace?: string | null;
  actor: TimelineActor;
  kind: TimelineKind;
  title: string;
  detail?: string | null;
  runId?: string | null;
  automation?: string | null;
  path?: string | null;
  facts?: TimelineFacts;
  at?: Date;
}

/** The event of one automation run */
export type RunEvent = NewEvent & { runId: string };

interface Row {
  id: bigint | string;
  at: Date;
  workspace: string | null;
  actor: TimelineActor;
  kind: TimelineKind;
  title: string;
  detail: string | null;
  run_id: string | null;
  automation: string | null;
  path: string | null;
  facts: TimelineFacts;
}

/** How many entities of a workspace stand in each state, as the feed counts them */
export async function stateCounts(index: { sql: Sql; schema: string }): Promise<EntityStates> {
  const rows = await index.sql.unsafe<{ verification: EntityState; sync: EntityState; n: number }[]>(
    `select verification, sync, count(*)::int as n from ${index.schema}.entity group by verification, sync`,
  );
  const counts: EntityStates = {};
  for (const r of rows) for (const s of [r.verification, r.sync]) counts[s] = (counts[s] ?? 0) + r.n;
  return counts;
}

/** The sum of state moves, or of counts taken with a sign: only the states that moved */
export function addStates(a: EntityStates | undefined, b: EntityStates | undefined, sign: 1 | -1 = 1): EntityStates {
  const out: EntityStates = { ...a };
  for (const [s, n] of Object.entries(b ?? {}) as [EntityState, number][]) out[s] = (out[s] ?? 0) + sign * n;
  for (const s of Object.keys(out) as EntityState[]) if (!out[s]) delete out[s];
  return out;
}

/** An action and what it did to the counts of a workspace's entities by state */
export async function measured<T>(index: { sql: Sql; schema: string }, fn: () => Promise<T>): Promise<[T, EntityStates]> {
  const before = await stateCounts(index);
  const value = await fn();
  return [value, addStates(await stateCounts(index), before, -1)];
}

/** Facts with the state moves of one more change summed in */
const withStates = (facts: TimelineFacts, more: EntityStates | undefined): TimelineFacts => {
  const { states: _, ...rest } = facts;
  const states = addStates(facts.states, more);
  return Object.keys(states).length ? { ...rest, states } : rest;
};

/** "consistency-check" → "Consistency check" */
export function automationLabel(a: string): string {
  const s = a.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const quoted = (title: string) => `“${title}”`;

/** Chats and interviews: the user talks to them turn by turn, and their turns are the user's own events */
export const conversational = (automation: string) => automation === 'chat' || automation === 'interview';

const RUN_KIND: Record<'finished' | 'failed' | 'killed', TimelineKind> = { finished: 'run_finished', failed: 'run_failed', killed: 'run_killed' };

const firstLine = (s: string | null | undefined) => s?.split('\n').find((l) => l.trim())?.trim() ?? null;

/** Commits from before runs described their work said only which run made them: nothing worth showing */
const PLACEHOLDER = /^momentum: [\w-]+ run [0-9a-f]+$/;
const subjectOf = (message: string | null | undefined) => {
  const line = firstLine(message);
  return line && !PLACEHOLDER.test(line) ? line : null;
};

/** What a run did, in one line: what it landed (the subject of its commit) once it landed something, or why it failed */
export function describeRun(automation: string, kind: TimelineKind, facts: TimelineFacts, detail: string | null): string {
  // The automation is shown beside the title and the icon says what happened: the title is what the run did
  const own = facts.runTitle ? `: ${facts.runTitle}` : '';
  const counts = [facts.issues ? plural(facts.issues, 'issue') : '', facts.conflicts?.length ? plural(facts.conflicts.length, 'conflict') : ''].filter(Boolean);
  const did = facts.subject ? `${facts.subject}${counts.length ? ` · ${counts.join(', ')}` : ''}` : null;
  switch (kind) {
    case 'run_failed':
      return `Failed: ${firstLine(detail) ?? 'no reason given'}`;
    case 'run_killed':
      return `Stopped${facts.byUser ? ' by you' : ''}${did ? `: ${did}` : own}`;
    case 'run_finished':
    case 'changes_landed':
      return did ?? (facts.paths?.length ? `Updated ${plural(facts.paths.length, 'entity', 'entities')}` : 'No changes');
  }
  return facts.runTitle ?? automationLabel(automation);
}

/** A run as it came out; its title says what it did, and its facts how it ran */
export function runEvent(
  workspace: string,
  run: {
    id: string;
    automation: string;
    title?: string;
    targetPath?: string | null;
    target_path?: string | null;
    trigger?: RunTrigger;
    model?: string | null;
    risk?: Risk | null;
  },
  kind: TimelineKind,
  extra: { detail?: string | null; facts?: TimelineFacts; at?: Date; byUser?: boolean } = {},
): RunEvent {
  const facts: TimelineFacts = {
    ...(run.title ? { runTitle: run.title } : {}),
    ...(run.trigger ? { trigger: run.trigger } : {}),
    ...(run.model ? { model: run.model } : {}),
    ...(run.risk ? { risk: run.risk } : {}),
    ...(extra.byUser ? { byUser: true } : {}),
    ...extra.facts,
  };
  const detail = extra.detail ?? null;
  return {
    workspace,
    actor: 'automation',
    kind,
    title: describeRun(run.automation, kind, facts, detail),
    detail,
    runId: run.id,
    automation: run.automation,
    path: run.targetPath ?? run.target_path ?? null,
    facts,
    at: extra.at,
  };
}

/** How a run ended, as the kind of its event */
export const endKind = (status: RunStatus): TimelineKind => RUN_KIND[status as keyof typeof RUN_KIND] ?? 'run_failed';

/** A reaction to a feed item, as the user's event */
export function reactionEvent(
  workspace: string,
  item: { path: string; type: string; title: string },
  reaction: 'approved' | 'sent_back' | 'resolved' | 'wont_resolve',
  extra: { detail?: string | null; runId?: string | null; timeSpentMs?: number; states?: EntityStates; at?: Date } = {},
): NewEvent {
  const verb = { approved: 'Approved', sent_back: 'Sent back', resolved: 'Resolved', wont_resolve: "Won't resolve" }[reaction];
  return {
    workspace,
    actor: 'user',
    kind: reaction,
    title: `${verb} ${quoted(item.title)}`,
    detail: extra.detail ?? null,
    runId: extra.runId ?? null,
    automation: extra.runId ? 'chat' : null,
    path: item.path,
    facts: withStates(extra.timeSpentMs ? { timeSpentMs: extra.timeSpentMs } : {}, extra.states),
    at: extra.at,
  };
}

interface Landed {
  workspace: string;
  runId: string;
  automation: string;
  commit: string | null;
  message: string | null;
  paths: string[];
  removed?: { path: string; title: string }[];
  issues: number;
  conflicts: string[];
  /** What landing did to the counts of entities by state */
  states?: EntityStates;
  at?: Date;
}

/** What one or more landings of a run add to its event */
const landedFacts = (l: Pick<Landed, 'paths' | 'removed' | 'issues' | 'conflicts' | 'commit' | 'message'>): TimelineFacts => ({
  paths: l.paths,
  ...(l.removed?.length ? { removed: l.removed } : {}),
  issues: l.issues,
  conflicts: l.conflicts,
  ...(l.commit ? { commit: l.commit } : {}),
  ...(subjectOf(l.message) ? { subject: subjectOf(l.message)! } : {}),
});


/**
 * Everything that happened in the harness: one event per thing the user did, and one per automation run for what came
 * of it, added once the run lands its changes or ends and moved to the time of its latest change. Kept across project
 * resets, so the history of a project outlives its index.
 */
export class Timeline {
  constructor(private readonly sql: Sql) {}

  async migrate(): Promise<void> {
    await this.sql`create table if not exists harness.timeline_event (
      id bigserial primary key,
      at timestamptz not null default now(),
      workspace text,
      actor text not null,
      kind text not null,
      title text not null,
      detail text,
      run_id text,
      automation text,
      path text,
      facts jsonb not null default '{}'
    )`;
    await this.sql`create index if not exists timeline_event_at on harness.timeline_event (at desc, id desc)`;
    await this.sql`create index if not exists timeline_event_workspace on harness.timeline_event (workspace, at desc, id desc)`;
    await this.sql`create unique index if not exists timeline_event_run on harness.timeline_event (run_id) where actor = 'automation'`;
    // Runs were once shown while they waited and ran; only what came of them is shown now
    await this.sql`delete from harness.timeline_event where kind in ('run_queued', 'run_requeued', 'run_started', 'run_resumed')`;
  }

  /** Recording never fails the action it records: a lost event is logged */
  async record(e: NewEvent): Promise<void> {
    await this.insert([e]).catch((err) => console.error(`timeline ${e.kind}:`, err));
  }

  /** The event of a run, as it came out: the first adds it, every later one replaces it and moves it to now */
  run(e: RunEvent): Promise<void> {
    return this.update(e.runId, (old) => {
      const facts = withStates({ ...old?.facts, ...e.facts, states: old?.facts.states }, e.facts?.states);
      const detail = e.detail ?? old?.detail ?? null;
      return { ...e, path: e.path ?? old?.path ?? null, facts, detail, title: describeRun(e.automation!, e.kind, facts, detail) };
    });
  }

  /**
   * What a run landed goes on its event without changing its state or moving it; a chat or an interview, whose turns are
   * the user's, gets an event of its own for it
   */
  private landed(l: Landed): Promise<void> {
    return this.update(l.runId, (old) => {
      const facts = withStates({ ...old?.facts, ...landedFacts(l) }, l.states);
      const kind = old?.kind ?? 'changes_landed';
      const detail = old?.detail ?? l.message;
      return {
        workspace: l.workspace,
        actor: 'automation',
        kind,
        title: describeRun(l.automation, kind, facts, detail),
        detail,
        runId: l.runId,
        automation: l.automation,
        path: old?.path ?? null,
        facts,
        at: old?.at,
      };
    });
  }

  /** The changes to one run's event, one after another, so none is lost */
  private chains = new Map<string, Promise<void>>();

  private update(runId: string, next: (old: Row | undefined) => NewEvent): Promise<void> {
    const done: Promise<void> = (this.chains.get(runId) ?? Promise.resolve())
      .then(async () => {
        const [old] = await this.sql<Row[]>`select * from harness.timeline_event where run_id = ${runId} and actor = 'automation'`;
        const r = this.row(next(old));
        await this.sql`insert into harness.timeline_event ${this.sql(r as never)}
          on conflict (run_id) where actor = 'automation' do update set
            at = excluded.at, kind = excluded.kind, title = excluded.title, path = excluded.path, detail = excluded.detail, facts = excluded.facts`;
      })
      .catch((err) => console.error(`timeline event of run ${runId}:`, err))
      .finally(() => {
        if (this.chains.get(runId) === done) this.chains.delete(runId);
      });
    this.chains.set(runId, done);
    return done;
  }

  private row(e: NewEvent) {
    return {
      at: e.at ?? new Date(),
      workspace: e.workspace ?? null,
      actor: e.actor,
      kind: e.kind,
      title: e.title,
      detail: e.detail ?? null,
      run_id: e.runId ?? null,
      automation: e.automation ?? null,
      path: e.path ?? null,
      facts: this.sql.json((e.facts ?? {}) as never),
    };
  }

  private async insert(events: NewEvent[]): Promise<void> {
    for (let i = 0; i < events.length; i += 500) {
      await this.sql`insert into harness.timeline_event ${this.sql(events.slice(i, i + 500).map((e) => this.row(e)) as never)}`;
    }
  }

  /** What runs land on the main line, as the guard tells it */
  listen(bus: Bus): void {
    bus.on('transaction', (t) => {
      // A run that changed nothing landed nothing
      if (!t.commit && t.paths.length === 0 && t.valid) return;
      void this.landed(t);
    });
  }

  async list(q: TimelineQuery): Promise<TimelineResponse> {
    const s = this.sql;
    const rows = await s<Row[]>`select * from harness.timeline_event
      where true
        ${q.workspace ? s`and workspace = ${q.workspace}` : s``}
        ${q.actor ? s`and actor = ${q.actor}` : s``}
        ${q.before ? s`and (at, id) < (select at, id from harness.timeline_event where id = ${q.before})` : s``}
      order by at desc, id desc limit ${q.limit + 1}`;
    const page = rows.slice(0, q.limit);
    return {
      events: page.map(view),
      next: rows.length > q.limit ? Number(page.at(-1)!.id) : null,
    };
  }
}

function view(r: Row): TimelineEvent {
  return {
    id: Number(r.id),
    at: r.at.toISOString(),
    workspace: r.workspace,
    actor: r.actor,
    kind: r.kind,
    title: r.title,
    detail: r.detail,
    runId: r.run_id,
    automation: r.automation,
    path: r.path,
    facts: r.facts,
  };
}
