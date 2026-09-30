import type { MappingStatus } from '@momentum/contract';
import { config } from './config.ts';
import type { HarnessSettings } from './harness.ts';
import type { Workspace } from './workspaces.ts';

/** Every mapping run of a workspace continues on one branch, so each run sees what the earlier ones wrote */
export const mappingBranch = (ws: Workspace) => `momentum/mapping/${ws.name}`;

/** The prompt of one mapping run: where the previous run left off, and how much room the feed has */
export function mappingPrompt(progress: string | null, room: number): string {
  const start = progress
    ? `Progress reported by the previous mapping run:\n\n${progress}\n\nContinue from there.`
    : 'This is the first mapping run: start from the top of the repository.';
  return `Map this repository into the knowledge base.\n\n${start}\n\nThe attention feed has room for ${room} more items: write at most ${room} entities this run, then report your progress with report_mapping, including the share of the repository covered so far.`;
}

/**
 * The knowledge graph build of a workspace: state, runs, entities written, time and usage so far, and the full build
 * extrapolated from the share of the repository the runs report covered
 */
export async function mappingStatus(ws: Workspace, settings: HarnessSettings): Promise<MappingStatus> {
  const s = ws.index.schema;
  const { state, progress, since, coverage } = await settings.mapping(ws.name);
  const [r] = await ws.index.sql.unsafe<
    { runs: number; entities: number; five_hour: number | null; week: number | null; spent_ms: number; active: string | null }[]
  >(
    `select (select count(*)::int from ${s}.run where automation = 'mapping') as runs,
            (select count(distinct p)::int from ${s}.transaction t cross join unnest(t.paths) as p
               join ${s}.run r on r.id = t.run_id where r.automation = 'mapping' and t.status = 'validated') as entities,
            (select sum(usage_five_hour)::float8 from ${s}.run where automation = 'mapping') as five_hour,
            (select sum(usage_week)::float8 from ${s}.run where automation = 'mapping') as week,
            (select coalesce(sum(extract(epoch from coalesce(ended_at, now()) - started_at)), 0)::float8 * 1000
               from ${s}.run where automation = 'mapping' and started_at is not null) as spent_ms,
            (select id from ${s}.run where automation = 'mapping' and status in ('queued', 'running')
               order by created_at desc limit 1) as active`,
  );
  const usage = { fiveHour: r?.five_hour ?? null, week: r?.week ?? null };
  const spentMs = Math.round(r?.spent_ms ?? 0);
  const scale = (v: number | null) => (v === null || !coverage ? null : v / coverage);
  return {
    workspace: ws.name,
    state,
    progress,
    since: since ? since.toISOString() : null,
    runs: r?.runs ?? 0,
    entities: r?.entities ?? 0,
    usage,
    spentMs,
    coverage,
    estimate: coverage ? { totalMs: Math.round(spentMs / coverage), usage: { fiveHour: scale(usage.fiveHour), week: scale(usage.week) } } : null,
    activeRunId: r?.active ?? null,
    resettable: ws.name !== config.harnessName,
  };
}
