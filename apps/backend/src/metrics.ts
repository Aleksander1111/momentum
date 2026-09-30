import { AutomationName, type AutomationMetrics, type MetricsResponse, type MetricValue, type Series } from '@momentum/contract';
import type { Automations } from './automations.ts';
import type { Workspace } from './workspaces.ts';

const DAYS = 30;
const PATTERN_WINDOW = 10;

type Agg = 'avg' | 'sum' | 'count' | 'last';

/** Daily series over the last 30 days of one column of a metrics table */
async function series(ws: Workspace, table: string, column: string, agg: Agg, where = 'true'): Promise<Series> {
  const s = ws.index.schema;
  const at = table.endsWith('_metric') ? 'recorded_at' : 'created_at';
  const expr =
    agg === 'last'
      ? `(array_agg(${column} order by ${at} desc))[1]`
      : agg === 'count'
        ? 'count(*)'
        : `${agg}(${column})`;
  const rows = await ws.index.sql.unsafe<{ day: Date; value: number | null }[]>(
    `select d.day, x.value::float8 as value
     from generate_series(date_trunc('day', now()) - interval '${DAYS - 1} days', date_trunc('day', now()), interval '1 day') as d(day)
     left join (
       select date_trunc('day', ${at}) as day, ${expr} as value from ${s}.${table}
       where ${at} > now() - interval '${DAYS} days' and ${where} group by 1
     ) x on x.day = d.day order by d.day`,
  );
  let carry: number | null = null;
  return rows.map((r) => {
    let value = r.value;
    if (agg === 'last') value = carry = value ?? carry;
    return { at: r.day.toISOString(), value: value ?? 0 };
  });
}

function total(s: Series): number {
  return s.reduce((a, p) => a + p.value, 0);
}

function latest(s: Series): number {
  return s.at(-1)?.value ?? 0;
}

const metric = (value: number, s: Series): MetricValue => ({ value, series: s });

/** Runs, failures, time and usage of each automation over the last 7 days */
async function perAutomation(ws: Workspace, automations: Automations): Promise<AutomationMetrics[]> {
  const s = ws.index.schema;
  const runs = await ws.index.sql.unsafe<{ automation: string; runs: number; failed: number; avg_seconds: number | null }[]>(
    `select automation, count(*)::int as runs, count(*) filter (where status = 'failed')::int as failed,
            avg(extract(epoch from ended_at - started_at))::float8 as avg_seconds
     from ${s}.run where created_at > now() - interval '7 days' group by 1`,
  );
  const usage = await ws.index.sql.unsafe<{ automation: string; five_hour: number | null; week: number | null }[]>(
    `select automation, (sum(usage_five_hour) filter (where recorded_at > now() - interval '5 hours'))::float8 as five_hour,
            sum(usage_week)::float8 as week
     from ${s}.agent_metric where recorded_at > now() - interval '7 days' group by 1`,
  );
  const variants = new Map((await automations.approved()).map((d) => [d.name, d.variant]));
  const names = new Set([...runs.map((r) => r.automation), ...usage.map((u) => u.automation)]);
  return [...names]
    .filter((n): n is AutomationName => AutomationName.safeParse(n).success)
    .map((automation) => {
      const r = runs.find((x) => x.automation === automation);
      const u = usage.find((x) => x.automation === automation);
      return {
        automation,
        runs: r?.runs ?? 0,
        failed: r?.failed ?? 0,
        avgSeconds: r?.avg_seconds ?? null,
        usage: { fiveHour: u?.five_hour ?? null, week: u?.week ?? null },
        variant: variants.get(automation) ?? null,
      };
    })
    .sort((a, b) => (b.usage.week ?? 0) - (a.usage.week ?? 0) || b.runs - a.runs);
}

export async function workspaceMetrics(ws: Workspace, automations: Automations): Promise<MetricsResponse> {
  const s = ws.index.schema;
  const sql = ws.index.sql;
  const [usage] = await sql.unsafe<{ five_hour: number | null; week: number | null }[]>(
    `select (select sum(usage_five_hour) from ${s}.agent_metric where recorded_at > now() - interval '5 hours')::float8 as five_hour,
            (select sum(usage_week) from ${s}.agent_metric where recorded_at > now() - interval '7 days')::float8 as week`,
  );
  const [avg] = await sql.unsafe<{ seconds: number | null }[]>(
    `select avg(time_spent_ms) / 1000.0 as seconds from ${s}.attention_metric where recorded_at > now() - interval '${DAYS} days'`,
  );
  const [patterns] = await sql.unsafe<{ n: number }[]>(`select count(*)::int as n from ${s}.attention_pattern`);
  const [understanding] = await sql.unsafe<{ consistency: number }[]>(
    `select consistency from ${s}.understanding_metric order by recorded_at desc limit 1`,
  );
  const [runsWeek] = await sql.unsafe<{ n: number }[]>(
    `select count(*)::int as n from ${s}.run where created_at > now() - interval '7 days' and automation <> 'setup'`,
  );

  const timePerItem = (await series(ws, 'attention_metric', 'time_spent_ms', 'avg')).map((p) => ({ ...p, value: p.value / 1000 }));
  const approved = await series(ws, 'attention_metric', '1', 'count', `reaction = 'approved'`);
  const rejected = await series(ws, 'attention_metric', '1', 'count', `reaction = 'rejected'`);
  const sentBack = await series(ws, 'attention_metric', '1', 'count', `reaction = 'sent_back'`);
  const consistency = await series(ws, 'understanding_metric', 'consistency', 'last');
  const openIssues = await series(ws, 'understanding_metric', 'open_issues', 'last');
  const misalignments = await series(ws, 'agent_metric', 'misalignments', 'sum');
  const recurring = await series(ws, 'agent_metric', 'recurring_issues', 'sum');
  const runs = await series(ws, 'run', '1', 'count', `automation <> 'setup'`);
  const outstanding = await series(ws, 'implementation_metric', 'outstanding_issues', 'last');
  const bugs = await series(ws, 'implementation_metric', 'bugs', 'last');
  const defects = await series(ws, 'implementation_metric', 'defects', 'last');

  return {
    workspace: ws.name,
    since: new Date(Date.now() - DAYS * 86_400_000).toISOString(),
    usage: { fiveHour: usage?.five_hour ?? null, week: usage?.week ?? null },
    attention: {
      timePerItemSeconds: metric(Math.round(avg?.seconds ?? 0), timePerItem),
      approved: metric(total(approved), approved),
      rejected: metric(total(rejected), rejected),
      sentBack: metric(total(sentBack), sentBack),
      patternsAutomated: patterns?.n ?? 0,
    },
    understanding: {
      consistency: metric(understanding?.consistency ?? 1, consistency),
      openIssues: metric(latest(openIssues), openIssues),
    },
    agents: {
      misalignments: metric(total(misalignments), misalignments),
      recurringIssues: metric(total(recurring), recurring),
      runsThisWeek: metric(runsWeek?.n ?? 0, runs.slice(-7)),
      automations: await perAutomation(ws, automations),
    },
    implementation: {
      outstandingIssues: metric(latest(outstanding), outstanding),
      bugs: metric(latest(bugs), bugs),
      defects: metric(latest(defects), defects),
    },
  };
}

/** Reactions regular enough to become automatic approval or rejection: the last ten of one entity type all agree */
export async function detectPatterns(ws: Workspace, type: string): Promise<void> {
  const s = ws.index.schema;
  const rows = await ws.index.sql.unsafe<{ reaction: string }[]>(
    `select reaction from ${s}.attention_metric where entity_type = $1 order by recorded_at desc limit ${PATTERN_WINDOW}`,
    [type],
  );
  if (rows.length < PATTERN_WINDOW) return;
  const reaction = rows[0]!.reaction;
  if (!['approved', 'rejected'].includes(reaction) || rows.some((r) => r.reaction !== reaction)) return;
  await ws.index.sql.unsafe(
    `insert into ${s}.attention_pattern (pattern, outcome) values ($1, $2) on conflict (pattern) do update set outcome = excluded.outcome`,
    [`${type}: the last ${PATTERN_WINDOW} items ${reaction}`, reaction === 'approved' ? 'automatic approval' : 'automatic rejection'],
  );
}
