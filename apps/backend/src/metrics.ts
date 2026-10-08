import {
  AutomationName,
  Sync,
  Verification,
  type AutomationMetrics,
  type Histogram,
  type MetricsRange,
  type MetricsResponse,
  type MetricValue,
  type RunHistograms,
  type Series,
} from '@momentum/contract';
import { fileOf, serializeEntity } from '@momentum/entity';
import { commitPathsFrom } from '@momentum/runs';
import type { Automations } from './automations.ts';
import type { Workspace } from './workspaces.ts';

/** Reactions in a row that make a pattern: well past the three repeats anything new needs before it is proposed */
const PATTERN_WINDOW = 10;
export const PATTERN_TYPE = 'Harness/Pattern';

const RANGES: Record<MetricsRange, { unit: 'hour' | 'day'; points: number }> = {
  '24h': { unit: 'hour', points: 24 },
  '7d': { unit: 'day', points: 7 },
  '30d': { unit: 'day', points: 30 },
};

type Agg = 'avg' | 'sum' | 'count' | 'last';

/** The hours or days of a range, and the queries that read a table into them */
class Span {
  readonly unit: 'hour' | 'day';
  /** SQL for the start of the first bucket */
  readonly start: string;

  private constructor(
    private readonly ws: Workspace,
    range: MetricsRange,
    readonly buckets: Date[],
  ) {
    const { unit, points } = RANGES[range];
    this.unit = unit;
    this.start = `date_trunc('${unit}', now()) - interval '${points - 1} ${unit}s'`;
  }

  static async of(ws: Workspace, range: MetricsRange): Promise<Span> {
    const { unit, points } = RANGES[range];
    const rows = await ws.index.sql.unsafe<{ b: Date }[]>(
      `select generate_series(date_trunc('${unit}', now()) - interval '${points - 1} ${unit}s', date_trunc('${unit}', now()), interval '1 ${unit}') as b`,
    );
    return new Span(ws, range, rows.map((r) => r.b));
  }

  private expr(agg: Agg, column: string, at: string): string {
    if (agg === 'last') return `(array_agg(${column} order by ${at} desc))[1]`;
    if (agg === 'count') return 'count(*)';
    return `${agg}(${column})`;
  }

  /** Aggregates per bucket and, with `by`, per value of that column */
  private rows(table: string, at: string, expr: string, where: string, by?: string) {
    return this.ws.index.sql.unsafe<{ b: Date; k: string | null; v: number | null }[]>(
      `select date_trunc('${this.unit}', ${at}) as b, ${by ?? 'null'}::text as k, (${expr})::float8 as v from ${table}
       where ${at} >= ${this.start} and ${where} group by 1, 2`,
    );
  }

  /** Counts and sums are 0 where nothing happened, averages null, levels carry the last one forward */
  private fill(rows: { b: Date; v: number | null }[], agg: Agg, carry: number | null): Series {
    const byTime = new Map(rows.map((r) => [r.b.getTime(), r.v]));
    return this.buckets.map((b) => {
      let value = byTime.get(b.getTime()) ?? null;
      if (agg === 'last') value = carry = value ?? carry;
      else if (agg !== 'avg') value ??= 0;
      return { at: b.toISOString(), value };
    });
  }

  async series(table: string, column: string, agg: Agg, where = 'true', at = 'recorded_at'): Promise<Series> {
    const rows = await this.rows(table, at, this.expr(agg, column, at), where);
    let carry: number | null = null;
    if (agg === 'last') {
      const [r] = await this.ws.index.sql.unsafe<{ v: number | null }[]>(
        `select (${column})::float8 as v from ${table} where ${at} < ${this.start} and ${where} order by ${at} desc limit 1`,
      );
      carry = r?.v ?? null;
    }
    return this.fill(rows, agg, carry);
  }

  /** One series per value of `by` */
  async seriesBy(table: string, by: string, column: string, agg: Exclude<Agg, 'last'>, where = 'true', at = 'recorded_at') {
    const rows = await this.rows(table, at, this.expr(agg, column, at), where, by);
    const keys = new Set(rows.map((r) => r.k ?? ''));
    return new Map([...keys].map((k) => [k, this.fill(rows.filter((r) => r.k === k), agg, null)]));
  }

  /** `expr` over the whole range, per value of `by` */
  async figureBy(table: string, by: string, expr: string, where = 'true', at = 'recorded_at') {
    const rows = await this.ws.index.sql.unsafe<{ k: string; v: number | null }[]>(
      `select ${by}::text as k, (${expr})::float8 as v from ${table} where ${at} >= ${this.start} and ${where} group by 1`,
    );
    return new Map(rows.map((r) => [r.k, r.v]));
  }

  /**
   * Rows standing at the end of each bucket, counted per value of `by`: the latest row of each `key` before the bucket
   * ends, where `by` is null once the thing is gone
   */
  async standingBy(table: string, key: string, by: string, at: string): Promise<Map<string, Series>> {
    const rows = await this.ws.index.sql.unsafe<{ b: Date; k: string; v: number }[]>(
      `select b.b, s.k, count(*)::float8 as v
       from generate_series(${this.start}, date_trunc('${this.unit}', now()), interval '1 ${this.unit}') as b(b)
       cross join lateral (
         select distinct on (${key}) ${by}::text as k from ${table} where ${at} < b.b + interval '1 ${this.unit}' order by ${key}, ${at} desc
       ) s
       where s.k is not null group by 1, 2`,
    );
    const keys = new Set(rows.map((r) => r.k));
    return new Map([...keys].map((k) => [k, this.fill(rows.filter((r) => r.k === k), 'count', null)]));
  }

  async figure(table: string, expr: string, where = 'true', at = 'recorded_at'): Promise<number | null> {
    const [r] = await this.ws.index.sql.unsafe<{ v: number | null }[]>(
      `select (${expr})::float8 as v from ${table} where ${at} >= ${this.start} and ${where}`,
    );
    return r?.v ?? null;
  }
}

const total = (s: Series): number => s.reduce((a, p) => a + (p.value ?? 0), 0);
const latest = (s: Series): number | null => s.at(-1)?.value ?? null;
const metric = (value: number | null, series: Series): MetricValue => ({ value, series });
const summed = (series: Series): MetricValue => metric(total(series), series);

const DURATION = 'extract(epoch from ended_at - started_at)';

/** Runs, failures, time and usage of each automation over the range */
async function perAutomation(ws: Workspace, span: Span, automations: Automations): Promise<AutomationMetrics[]> {
  const s = ws.index.schema;
  const runs = await span.seriesBy(`${s}.run`, 'automation', '1', 'count', 'true', 'created_at');
  const failed = await span.seriesBy(`${s}.run`, 'automation', '1', 'count', `status = 'failed'`, 'created_at');
  const time = await span.seriesBy(`${s}.run`, 'automation', DURATION, 'avg', 'started_at is not null', 'ended_at');
  const avg = await span.figureBy(`${s}.run`, 'automation', `avg(${DURATION})`, 'started_at is not null', 'ended_at');
  const fiveHour = await span.seriesBy(`${s}.usage_share`, 'automation', 'five_hour', 'sum');
  const week = await span.seriesBy(`${s}.usage_share`, 'automation', 'week', 'sum');
  const rolling = await ws.index.sql.unsafe<{ automation: string; five_hour: number | null; week: number | null }[]>(
    `select automation, (sum(five_hour) filter (where recorded_at > now() - interval '5 hours'))::float8 as five_hour,
            sum(week)::float8 as week
     from ${s}.usage_share where recorded_at > now() - interval '7 days' group by 1`,
  );
  const variants = new Map((await automations.definitions()).map((d) => [d.name, d.variant]));
  const zeros = span.buckets.map((b) => ({ at: b.toISOString(), value: 0 }));
  const gaps = span.buckets.map((b) => ({ at: b.toISOString(), value: null }));
  const names = new Set([...runs.keys(), ...week.keys(), ...fiveHour.keys()]);
  return [...names]
    .filter((n): n is AutomationName => AutomationName.safeParse(n).success)
    .map((automation) => {
      const r = rolling.find((x) => x.automation === automation);
      return {
        automation,
        variant: variants.get(automation) ?? null,
        runs: summed(runs.get(automation) ?? zeros),
        failed: summed(failed.get(automation) ?? zeros),
        avgSeconds: metric(avg.get(automation) ?? null, time.get(automation) ?? gaps),
        usage: { fiveHour: summed(fiveHour.get(automation) ?? zeros), week: summed(week.get(automation) ?? zeros) },
        rolling: { fiveHour: r?.five_hour ?? null, week: r?.week ?? null },
      };
    })
    .sort((a, b) => (b.usage.week.value ?? 0) - (a.usage.week.value ?? 0) || (b.runs.value ?? 0) - (a.runs.value ?? 0));
}

const BINS = 12;
/** Bin widths: 1, 2, 2.5, 5 × 10ⁿ; 2.5 is skipped for counts, and time steps through whole minutes and hours */
const STEPS = { real: [1, 2, 2.5, 5], count: [1, 2, 5], seconds: [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400] };

function step(raw: number, scale: keyof typeof STEPS): number {
  if (scale === 'seconds' && raw <= 14400) return STEPS.seconds.find((s) => s >= raw) ?? 14400;
  const p = 10 ** Math.floor(Math.log10(raw));
  const w = (STEPS[scale === 'seconds' ? 'count' : scale].find((s) => s * p >= raw - 1e-9) ?? 10) * p;
  return scale === 'real' ? w : Math.max(1, Math.round(w));
}

/** At most BINS bins of one width from 0 past the largest value, the runs of each automation counted into them */
export function histogram(values: { automation: AutomationName; v: number }[], scale: keyof typeof STEPS): Histogram {
  const max = Math.max(0, ...values.map((x) => x.v));
  const width = max > 0 ? step(max / BINS, scale) : 1;
  const n = Math.max(1, Math.floor(max / width) + 1);
  const edges = Array.from({ length: n + 1 }, (_, i) => i * width);
  const counts = new Map<AutomationName, number[]>();
  for (const { automation, v } of values) {
    const c = counts.get(automation) ?? counts.set(automation, Array<number>(n).fill(0)).get(automation)!;
    c[Math.min(n - 1, Math.floor(v / width))]! += 1;
  }
  return { edges, automations: [...counts].map(([automation, c]) => ({ automation, counts: c })) };
}

/** Each parameter of the runs that ended in the range */
async function runHistograms(ws: Workspace, span: Span): Promise<RunHistograms> {
  const s = ws.index.schema;
  const rows = await ws.index.sql.unsafe<
    { automation: string; five_hour: number | null; week: number | null; seconds: number; messages: number }[]
  >(
    // Usage is the run's share of the shared limits; a run that started before shares were split has none
    `with first as (select min(recorded_at) as at from ${s}.usage_share)
     select automation, case when started_at >= first.at then coalesce(u.five_hour, 0) end::float8 as five_hour,
            case when started_at >= first.at then coalesce(u.week, 0) end::float8 as week, ${DURATION}::float8 as seconds,
            (select count(*) from ${s}.run_message m where m.run_id = r.id)::int as messages
     from ${s}.run r cross join first
     left join (select run_id, sum(five_hour) as five_hour, sum(week) as week from ${s}.usage_share group by 1) u on u.run_id = r.id
     where ended_at >= ${span.start} and started_at is not null`,
  );
  const runs = rows.filter((r): r is typeof r & { automation: AutomationName } => AutomationName.safeParse(r.automation).success);
  const of = (pick: (r: (typeof runs)[number]) => number | null) =>
    runs.flatMap((r) => {
      const v = pick(r);
      return v === null ? [] : [{ automation: r.automation, v }];
    });
  return {
    fiveHour: histogram(of((r) => r.five_hour), 'real'),
    week: histogram(of((r) => r.week), 'real'),
    seconds: histogram(of((r) => r.seconds), 'seconds'),
    messages: histogram(of((r) => r.messages), 'count'),
  };
}

export async function workspaceMetrics(ws: Workspace, automations: Automations, range: MetricsRange): Promise<MetricsResponse> {
  const s = ws.index.schema;
  const span = await Span.of(ws, range);
  const attention = `${s}.attention_metric`;

  /** The account's reading of one limit: the latest within its window, and the last reading of each bucket */
  const usage = async (column: string, window: string): Promise<MetricValue> => {
    const series = await span.series('harness.usage_sample', column, 'last', `${column} is not null`, 'at');
    const [r] = await ws.index.sql.unsafe<{ v: number | null }[]>(
      `select ${column}::float8 as v from harness.usage_sample where at > now() - interval '${window}' and ${column} is not null
       order by at desc limit 1`,
    );
    return metric(r?.v ?? null, series);
  };

  const timePerItem = await span.series(attention, 'time_spent_ms / 1000.0', 'avg');
  const approved = await span.series(attention, '1', 'count', `reaction = 'approved'`);
  const rejected = await span.series(attention, '1', 'count', `reaction = 'rejected'`);
  const sentBack = await span.series(attention, '1', 'count', `reaction = 'sent_back'`);
  // Patterns only accumulate, once the user accepted them: the count standing at the end of each bucket
  const newPatterns = await span.series(`${s}.attention_pattern`, '1', 'count', 'accepted_at is not null', 'accepted_at');
  let patterns = (await ws.index.sql.unsafe<{ n: number }[]>(
    `select count(*)::int as n from ${s}.attention_pattern where accepted_at < ${span.start}`,
  ))[0]!.n;
  const patternsAutomated = newPatterns.map((p) => ({ at: p.at, value: (patterns += p.value ?? 0) }));
  const consistency = await span.series(`${s}.understanding_metric`, 'consistency', 'last');
  const openIssues = await span.series(`${s}.understanding_metric`, 'open_issues', 'last');
  const misalignments = await span.series(`${s}.agent_metric`, 'misalignments', 'sum');
  const recurring = await span.series(`${s}.agent_metric`, 'recurring_issues', 'sum');
  const runs = await span.series(`${s}.run`, '1', 'count', 'true', 'created_at');
  const outstanding = await span.series(`${s}.implementation_metric`, 'outstanding_issues', 'last');
  const bugs = await span.series(`${s}.implementation_metric`, 'bugs', 'last');
  const defects = await span.series(`${s}.implementation_metric`, 'defects', 'last');
  const zeros = span.buckets.map((b) => ({ at: b.toISOString(), value: 0 }));
  // A count no automation has measured yet is no data, not zero
  const finished = new Set(
    (await ws.index.sql.unsafe<{ automation: string }[]>(`select distinct automation from ${s}.run where status = 'finished'`)).map((r) => r.automation),
  );
  const unmeasured: MetricValue = { value: null, series: span.buckets.map((b) => ({ at: b.toISOString(), value: null })) };
  const measuredBy = (automations: AutomationName[], v: MetricValue) => (automations.some((a) => finished.has(a)) ? v : unmeasured);
  const raisesIssues: AutomationName[] = ['consistency-check', 'validation'];
  const states = async <K extends string>(column: string, keys: readonly K[]) => {
    const by = await span.standingBy(`${s}.entity_state`, 'path', column, 'at');
    return Object.fromEntries(
      keys.map((k) => {
        const series = by.get(k) ?? zeros;
        return [k, metric(latest(series), series)];
      }),
    ) as Record<K, MetricValue>;
  };

  return {
    workspace: ws.name,
    range,
    since: span.buckets[0]!.toISOString(),
    usage: { fiveHour: await usage('five_hour', '5 hours'), week: await usage('week', '7 days') },
    attention: {
      timePerItemSeconds: metric(await span.figure(attention, 'round(avg(time_spent_ms) / 1000.0)'), timePerItem),
      approved: summed(approved),
      rejected: summed(rejected),
      sentBack: summed(sentBack),
      patternsAutomated: metric(patterns, patternsAutomated),
    },
    understanding: {
      consistency: metric(latest(consistency), consistency),
      openIssues: measuredBy(raisesIssues, metric(latest(openIssues), openIssues)),
    },
    agents: {
      misalignments: measuredBy(['optimization'], summed(misalignments)),
      recurringIssues: measuredBy(['optimization'], summed(recurring)),
      runs: summed(runs),
      automations: await perAutomation(ws, span, automations),
      runHistograms: await runHistograms(ws, span),
    },
    entities: {
      verification: await states('verification', Verification.options),
      sync: await states('sync', Sync.options),
    },
    implementation: {
      outstandingIssues: measuredBy(raisesIssues, metric(latest(outstanding), outstanding)),
      bugs: metric(latest(bugs), bugs),
      defects: measuredBy(['validation'], metric(latest(defects), defects)),
    },
    retrieval: await retrievalMetrics(ws, span),
  };
}

/** The ratings of the chats' retrieval over the range: each turn's, and each tool's against the others */
async function retrievalMetrics(ws: Workspace, span: Span): Promise<MetricsResponse['retrieval']> {
  const rag = `${ws.index.schema}.rag_metric`;
  const mean = async (column: string) => metric(await span.figure(rag, `avg(${column})`), await span.series(rag, column, 'avg'));
  const tools = await ws.index.sql.unsafe<{ tool: string; turns: number; calls: number; relevance: number; relative: number }[]>(
    `select tool, count(*)::int as turns, sum(calls)::int as calls, avg(relevance)::float8 as relevance, avg(relative)::float8 as relative
     from ${ws.index.schema}.retrieval_metric where recorded_at >= ${span.start} group by tool order by 5 desc, 3 desc`,
  );
  const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
  const automations = await ws.index.sql.unsafe<{ automation: string; turns: number; score: number }[]>(
    `select automation, count(*)::int as turns, avg(score)::float8 as score from ${rag} where recorded_at >= ${span.start} group by 1 order by 3`,
  );
  const relative = await span.seriesBy(`${ws.index.schema}.retrieval_metric`, 'tool', 'relative', 'avg');
  const gaps = span.buckets.map((b) => ({ at: b.toISOString(), value: null }));
  return {
    score: await mean('score'),
    precision: await mean('precision'),
    coverage: await mean('coverage'),
    parallel: await mean('parallel::int'),
    turns: summed(await span.series(rag, '1', 'count')),
    automations: automations
      .filter((a): a is typeof a & { automation: AutomationName } => AutomationName.safeParse(a.automation).success)
      .map((a) => ({ ...a, score: round(a.score, 2) })),
    tools: tools.map((t) => ({ ...t, relevance: round(t.relevance, 1), relative: round(t.relative, 2), series: relative.get(t.tool) ?? gaps })),
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Reactions regular enough to become automatic approval or rejection: the last ten of one entity type all agree. Nothing
 * of the user's behaviour is automated behind their back: the pattern is proposed as a Harness/Pattern entity, which
 * lands unverified and waits in the feed, and counts only once they approve it. True when a proposal was written.
 */
export async function detectPatterns(ws: Workspace, type: string): Promise<boolean> {
  // Reactions to the proposals themselves make no pattern of their own
  if (type === PATTERN_TYPE) return false;
  const s = ws.index.schema;
  const rows = await ws.index.sql.unsafe<{ reaction: string }[]>(
    `select reaction from ${s}.attention_metric where entity_type = $1 order by recorded_at desc limit ${PATTERN_WINDOW}`,
    [type],
  );
  if (rows.length < PATTERN_WINDOW) return false;
  const reaction = rows[0]!.reaction;
  if (!['approved', 'rejected'].includes(reaction) || rows.some((r) => r.reaction !== reaction)) return false;
  const pattern = `${type}: the last ${PATTERN_WINDOW} items ${reaction}`;
  const outcome = reaction === 'approved' ? 'automatic approval' : 'automatic rejection';
  const [known] = await ws.index.sql.unsafe<{ entity_path: string | null }[]>(
    `select entity_path from ${s}.attention_pattern where pattern = $1`,
    [pattern],
  );
  if (known?.entity_path) return false;
  const verb = reaction === 'approved' ? 'Approve' : 'Reject';
  const path = `${PATTERN_TYPE}/${slug(`${outcome} ${type}`)}`;
  const text = serializeEntity({
    frontmatter: {
      type: PATTERN_TYPE,
      origin: 'automation',
      verification: 'unverified',
      sync: 'synced',
      product_impact: 2,
      timeline_impact: 2,
      unlocks: 2,
      references: [],
      artifacts: [],
      pattern,
      outcome,
      entity_type: type,
      seen: PATTERN_WINDOW,
    } as never,
    title: `${verb} ${type} items automatically`,
    body: [
      `You ${reaction} the last ${PATTERN_WINDOW} ${type} items in a row, none of them reacted to otherwise.`,
      '',
      `- Approve this to accept it as a pattern of yours: ${outcome} of ${type} items`,
      '- Until you do, nothing about your reactions is automated; send it back to keep reacting to each item yourself',
      '- Accepted patterns are counted on the metrics page; the harness still shows you every item',
    ].join('\n'),
  });
  await commitPathsFrom(ws.path, ws.main, [{ path: fileOf(path), content: text }], `Propose a pattern: ${pattern}`);
  await ws.index.sql.unsafe(
    `insert into ${s}.attention_pattern (pattern, outcome, entity_path) values ($1, $2, $3)
     on conflict (pattern) do update set outcome = excluded.outcome, entity_path = excluded.entity_path, accepted_at = null`,
    [pattern, outcome, path],
  );
  return true;
}

/** An approved Harness/Pattern: the pattern it proposed is accepted from now on */
export async function acceptPattern(ws: Workspace, path: string): Promise<void> {
  await ws.index.sql.unsafe(
    `update ${ws.index.schema}.attention_pattern set accepted_at = coalesce(accepted_at, now()) where entity_path = $1`,
    [path],
  );
}
