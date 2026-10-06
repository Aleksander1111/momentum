import { AutomationName, Origin, Risk, RunStatus, RunTrigger, Sync, Verification } from '@momentum/contract';
import postgres from 'postgres';

export type Sql = postgres.Sql<Record<string, never>>;

export function connect(url = process.env.DATABASE_URL): Sql {
  if (!url) throw new Error('DATABASE_URL is not set');
  return postgres(url, {
    onnotice: () => {},
    max: 10,
    types: { bigint: postgres.BigInt },
  }) as unknown as Sql;
}

/** Schema of a workspace: ws_<name>, lower case, anything outside [a-z0-9_] replaced */
export function schemaOf(workspace: string): string {
  return `ws_${workspace.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
}

export const EMBEDDING_DIMENSIONS = 384;

const HARNESS = /* sql */ `
create extension if not exists vector;
create schema if not exists harness;
create table if not exists harness.project (
  name text primary key,
  path text not null,
  enabled boolean not null default false
);
create table if not exists harness.setting (
  key text primary key,
  value jsonb not null
);
create table if not exists harness.credential (
  id int primary key check (id = 1),
  password_hash text not null
);
create table if not exists harness.session (
  token_hash text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists harness.usage_sample (
  at timestamptz not null default now(),
  five_hour real,
  week real
);
create index if not exists usage_sample_at on harness.usage_sample (at);
create table if not exists harness.voice_cursor (
  session text primary key,
  last_item int not null,
  at timestamptz not null default now()
);
create index if not exists session_expires on harness.session (expires_at);
-- Which workspace each run is in, for the routes that know a run by its id alone
create table if not exists harness.run_ref (id text primary key, workspace text not null);
create index if not exists run_ref_workspace on harness.run_ref (workspace);
`;

/**
 * The values a column may hold, as the contract has them: checked by the database on every row written from now on.
 * Each check is replaced whole on every start, so it follows the contract; `not valid` leaves rows from before as they
 * stand (a run of an automation since renamed, for one).
 */
const CHECKS: [table: string, column: string, values: readonly string[]][] = [
  ['entity', 'origin', Origin.options],
  ['entity', 'verification', Verification.options],
  ['entity', 'sync', Sync.options],
  ['run', 'automation', AutomationName.options],
  ['run', 'trigger', RunTrigger.options],
  ['run', 'status', RunStatus.options],
  ['run', 'risk', Risk.options],
  ['transaction', 'status', ['validated', 'invalid']],
  ['attention_metric', 'reaction', ['approved', 'rejected', 'sent_back']],
];

function checksDdl(s: string): string {
  return CHECKS.map(([table, column, values]) => {
    const name = `${table}_${column}_check`;
    const list = values.map((v) => `'${v}'`).join(', ');
    return `alter table ${s}.${table} drop constraint if exists ${name};\nalter table ${s}.${table} add constraint ${name} check (${column} in (${list})) not valid;`;
  }).join('\n');
}

function workspaceDdl(s: string): string {
  return /* sql */ `
create schema if not exists ${s};
create table if not exists ${s}.entity (
  path text primary key,
  type text not null,
  title text not null,
  card text not null,
  origin text not null,
  verification text not null,
  sync text not null,
  card_blocks jsonb not null default '[]',
  frontmatter jsonb not null default '{}',
  contradictions int not null default 0,
  search tsvector generated always as (
    setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', card), 'B')
  ) stored,
  embedding vector(${EMBEDDING_DIMENSIONS}),
  updated_at timestamptz not null default now()
);
create index if not exists entity_search on ${s}.entity using gin (search);
create index if not exists entity_type on ${s}.entity (type);
-- Everything lives on the main line: no run branches hold unapproved versions any more
alter table ${s}.entity drop column if exists branch;
alter table ${s}.entity drop column if exists run_id;
alter table ${s}.entity add column if not exists contradictions int not null default 0;
-- The card against its last verified version, while the entity is unverified
alter table ${s}.entity add column if not exists card_diff jsonb;
create table if not exists ${s}.entity_state (
  path text not null,
  verification text,
  sync text,
  at timestamptz not null default now()
);
create index if not exists entity_state_path on ${s}.entity_state (path, at);
-- History starts with the states standing when the log was added
insert into ${s}.entity_state (path, verification, sync)
  select path, verification, sync from ${s}.entity e where not exists (select 1 from ${s}.entity_state x where x.path = e.path);
create table if not exists ${s}.entity_artifact (
  entity_path text not null references ${s}.entity (path) on delete cascade,
  artifact_path text not null,
  primary key (entity_path, artifact_path)
);
create index if not exists entity_artifact_artifact on ${s}.entity_artifact (artifact_path);
create table if not exists ${s}.entity_reference (
  from_path text not null references ${s}.entity (path) on delete cascade,
  to_path text not null,
  relation_type text not null,
  primary key (from_path, to_path, relation_type)
);
create index if not exists entity_reference_to on ${s}.entity_reference (to_path);
create table if not exists ${s}.automation (
  name text primary key,
  responsibility text not null,
  definition text not null,
  trigger text
);
create table if not exists ${s}.run (
  id text primary key,
  automation text not null,
  checkout text not null,
  trigger text not null,
  target_path text,
  status text not null,
  title text not null default '',
  prompt text not null default '',
  base_commit text,
  session_id text,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);
create index if not exists run_status on ${s}.run (status);
alter table ${s}.run add column if not exists usage_five_hour real;
alter table ${s}.run add column if not exists usage_week real;
alter table ${s}.run add column if not exists model text;
alter table ${s}.run add column if not exists risk text;
alter table ${s}.run add column if not exists restarts int not null default 0;
alter table ${s}.run drop column if exists branch;
-- A message to a chat whose run has ended: the run is queued again and resumes its session with it
alter table ${s}.run add column if not exists resume_prompt text;
-- An interview as its last turn left it: the question asked, whether it is done, the document it writes
alter table ${s}.run add column if not exists interview jsonb;
-- Entities the run works on besides its target, such as those a summarization run rewrites
alter table ${s}.run add column if not exists targets text[] not null default '{}';
create table if not exists ${s}.run_message (
  run_id text not null references ${s}.run (id) on delete cascade,
  seq int not null,
  role text not null,
  text text not null,
  at timestamptz not null default now(),
  primary key (run_id, seq)
);
-- Parts of cards the user added to the message: quotes and diagram elements
alter table ${s}.run_message add column if not exists context jsonb not null default '[]';
create table if not exists ${s}.chat (
  run_id text primary key references ${s}.run (id) on delete cascade,
  entity_path text
);
create table if not exists ${s}.transaction (
  id bigserial primary key,
  run_id text not null,
  commit text,
  paths text[] not null,
  status text not null,
  issues jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table ${s}.transaction drop column if exists branch;
alter table ${s}.transaction add column if not exists commit text;
alter table ${s}.transaction add column if not exists conflicts text[] not null default '{}';
create table if not exists ${s}.attention_ranking (
  entity_path text primary key references ${s}.entity (path) on delete cascade,
  product_impact int not null,
  timeline_impact int not null,
  unlocks int not null,
  rank real generated always as (product_impact + timeline_impact + unlocks) stored,
  entered_at timestamptz not null default now()
);
create index if not exists attention_ranking_rank on ${s}.attention_ranking (rank desc, entered_at);
create table if not exists ${s}.attention_metric (
  id bigserial primary key,
  entity_path text not null,
  entity_type text not null,
  time_spent_ms int not null,
  reaction text not null,
  recorded_at timestamptz not null default now()
);
create table if not exists ${s}.attention_pattern (
  pattern text primary key,
  outcome text not null,
  detected_at timestamptz not null default now()
);
-- A pattern is proposed to the user as a Harness/Pattern entity and counts only once they approve it
alter table ${s}.attention_pattern add column if not exists entity_path text;
alter table ${s}.attention_pattern add column if not exists accepted_at timestamptz;
create table if not exists ${s}.understanding_metric (
  consistency real not null,
  open_issues int not null,
  recorded_at timestamptz not null default now()
);
create table if not exists ${s}.agent_metric (
  id bigserial primary key,
  run_id text not null,
  automation text not null,
  misalignments int not null default 0,
  recurring_issues int not null default 0,
  variant text,
  usage_five_hour real,
  usage_week real,
  recorded_at timestamptz not null default now()
);
create table if not exists ${s}.usage_share (
  run_id text not null,
  automation text not null,
  five_hour real not null default 0,
  week real not null default 0,
  recorded_at timestamptz not null default now()
);
create index if not exists usage_share_at on ${s}.usage_share (recorded_at);
create table if not exists ${s}.implementation_metric (
  outstanding_issues int not null,
  bugs int not null,
  defects int not null,
  recorded_at timestamptz not null default now()
);
-- The graph build was called mapping
update ${s}.run set automation = 'graph-build' where automation = 'mapping';
update ${s}.agent_metric set automation = 'graph-build' where automation = 'mapping';
delete from ${s}.automation where name = 'mapping';
-- What the metrics, the run queue, the feed's reactions and the timeline look rows up by
create index if not exists attention_metric_recorded on ${s}.attention_metric (recorded_at);
create index if not exists attention_metric_type on ${s}.attention_metric (entity_type, recorded_at desc);
create index if not exists understanding_metric_recorded on ${s}.understanding_metric (recorded_at);
create index if not exists implementation_metric_recorded on ${s}.implementation_metric (recorded_at);
create index if not exists agent_metric_recorded on ${s}.agent_metric (recorded_at);
create index if not exists usage_share_run on ${s}.usage_share (run_id);
drop index if exists ${s}.entity_state_path;
create index if not exists entity_state_path_at on ${s}.entity_state (path, at desc);
create index if not exists run_automation_status on ${s}.run (automation, status);
create index if not exists run_created on ${s}.run (created_at);
create index if not exists run_chat_target on ${s}.run (target_path) where automation = 'chat';
create index if not exists transaction_run on ${s}.transaction (run_id);
create index if not exists transaction_created on ${s}.transaction (created_at);
${checksDdl(s)}
`;
}

/** How long readings of the account's limits are kept: the metrics show thirty days at most */
const KEEP_READINGS_DAYS = 35;

/** Sessions past their expiry and readings older than any metric shows; the rest of the history is the user's */
export async function pruneHarness(sql: Sql): Promise<void> {
  await sql`delete from harness.session where expires_at < now()`;
  await sql`delete from harness.usage_sample where at < now() - make_interval(days => ${KEEP_READINGS_DAYS})`;
}

export async function pruneWorkspace(sql: Sql, workspace: string): Promise<void> {
  await sql.unsafe(`delete from ${schemaOf(workspace)}.usage_share where recorded_at < now() - make_interval(days => $1)`, [KEEP_READINGS_DAYS]);
}

export async function migrateHarness(sql: Sql): Promise<void> {
  await sql.unsafe(HARNESS);
}

export async function migrateWorkspace(sql: Sql, workspace: string): Promise<void> {
  await sql.unsafe(workspaceDdl(schemaOf(workspace)));
}
