import type { Completeness, GraphBuildStatus } from '@momentum/contract';
import { listFiles } from '@momentum/runs';
import { measureCompleteness } from './completeness.ts';
import { config } from './config.ts';
import type { HarnessSettings } from './harness.ts';
import type { Workspace } from './workspaces.ts';

/**
 * The prompt of one graph build run: where the previous run left off, what the harness measured missing, and how much
 * room the feed has. The runs go one at a time and each lands on the main line, so every run sees what the earlier
 * ones wrote.
 */
export function graphBuildPrompt(progress: string | null, room: number, completeness: Completeness): string {
  const start = progress
    ? `Progress reported by the previous graph build run:\n\n${progress}\n\nContinue from there.`
    : 'This is the first graph build run: start from the top of the repository.';
  return `Build the knowledge graph of this repository.\n\n${start}\n\n${gaps(completeness)}\n\nThe attention feed has room for ${room} more items: write at most ${room} entities this run, then report your progress with report_graph_build.`;
}

/** What the measure found missing, for the run to take up: the slots unfilled, and the areas not accounted for */
export function gaps(c: Completeness): string {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const slots = c.understanding.slots.filter((s) => !s.filled);
  const areas = c.territory.areas.filter((a) => a.score < 1);
  const lines = [
    `The harness measures the graph ${pct(c.score)} complete: ${pct(c.understanding.score)} of what a reader needs answered, ${pct(c.territory.score)} of the repository accounted for.`,
  ];
  if (slots.length) lines.push(`Not answered yet, with the entity types that answer it:\n${slots.map((s) => `- ${s.name}: ${s.types.join(', ')}`).join('\n')}`);
  if (areas.length) {
    lines.push(
      `Areas of the repository no entity accounts for yet (an area's missing parts in brackets; \`<dir>/*\` means the files directly in it):\n${areas.map((a) => `- ${a.path} (${pct(a.score)}: ${a.missing.join(', ')})`).join('\n')}`,
    );
  }
  if (!slots.length && !areas.length) lines.push('Nothing is missing: report complete unless you see what the measure cannot.');
  lines.push(
    'An entity accounts for an area by listing it, or anything in it, in `artifacts`; a directory listed claims all in it, so one entity can account for a whole area when nothing in it deserves its own. Entities of implementation-detail types (Code/SourceFile, Class, Function, Data/Column and the like) account for nothing: the graph exists to spare the reader those. Fill the slots the repository can fill, and report complete only once what is still missing cannot be found in the repository.',
  );
  return lines.join('\n\n');
}

/** How complete the workspace's knowledge graph is, measured on the main line as it stands */
export async function completeness(ws: Workspace, settings: HarnessSettings): Promise<Completeness> {
  const [files, claims, { summarization }] = await Promise.all([listFiles(ws.path, `refs/heads/${ws.main}`, '.'), ws.index.claims(), settings.values()]);
  return measureCompleteness(files, claims.artifacts, claims.types, summarization.exclude);
}

/**
 * The knowledge graph build of a workspace: state, runs, entities written, time and usage so far, how complete the
 * graph is, and the full build extrapolated from what that completeness took
 */
export async function graphBuildStatus(ws: Workspace, settings: HarnessSettings): Promise<GraphBuildStatus> {
  const s = ws.index.schema;
  const { state, progress, since } = await settings.graphBuild(ws.name);
  const [r] = await ws.index.sql.unsafe<
    { runs: number; entities: number; five_hour: number | null; week: number | null; spent_ms: number; active: string | null }[]
  >(
    `select (select count(*)::int from ${s}.run where automation = 'graph-build') as runs,
            (select count(distinct p)::int from ${s}.transaction t cross join unnest(t.paths) as p
               join ${s}.run r on r.id = t.run_id where r.automation = 'graph-build' and t.status = 'validated') as entities,
            (select sum(usage_five_hour)::float8 from ${s}.run where automation = 'graph-build') as five_hour,
            (select sum(usage_week)::float8 from ${s}.run where automation = 'graph-build') as week,
            (select coalesce(sum(extract(epoch from coalesce(ended_at, now()) - started_at)), 0)::float8 * 1000
               from ${s}.run where automation = 'graph-build' and started_at is not null) as spent_ms,
            (select id from ${s}.run where automation = 'graph-build' and status in ('queued', 'running')
               order by created_at desc limit 1) as active`,
  );
  const measured = await completeness(ws, settings);
  const usage = { fiveHour: r?.five_hour ?? null, week: r?.week ?? null };
  const spentMs = Math.round(r?.spent_ms ?? 0);
  const scale = (v: number | null) => (v === null ? null : v / measured.score);
  return {
    workspace: ws.name,
    state,
    progress,
    since: since ? since.toISOString() : null,
    runs: r?.runs ?? 0,
    entities: r?.entities ?? 0,
    usage,
    spentMs,
    completeness: measured,
    estimate: measured.score > 0 && (r?.runs ?? 0) > 0 ? { totalMs: Math.round(spentMs / measured.score), usage: { fiveHour: scale(usage.fiveHour), week: scale(usage.week) } } : null,
    activeRunId: r?.active ?? null,
    resettable: ws.name !== config.harnessName,
  };
}
