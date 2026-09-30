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
`;

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
  branch text,
  run_id text,
  search tsvector generated always as (
    setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', card), 'B')
  ) stored,
  embedding vector(${EMBEDDING_DIMENSIONS}),
  updated_at timestamptz not null default now()
);
create index if not exists entity_search on ${s}.entity using gin (search);
create index if not exists entity_type on ${s}.entity (type);
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
  branch text not null,
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
create table if not exists ${s}.run_message (
  run_id text not null references ${s}.run (id) on delete cascade,
  seq int not null,
  role text not null,
  text text not null,
  at timestamptz not null default now(),
  primary key (run_id, seq)
);
create table if not exists ${s}.chat (
  run_id text primary key references ${s}.run (id) on delete cascade,
  entity_path text
);
create table if not exists ${s}.transaction (
  id bigserial primary key,
  run_id text not null,
  branch text not null,
  paths text[] not null,
  status text not null,
  issues jsonb not null default '[]',
  created_at timestamptz not null default now()
);
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
update ${s}.run set branch = replace(branch, 'momentum/mapping/', 'momentum/graph-build/') where branch like 'momentum/mapping/%';
update ${s}.entity set branch = replace(branch, 'momentum/mapping/', 'momentum/graph-build/') where branch like 'momentum/mapping/%';
update ${s}.transaction set branch = replace(branch, 'momentum/mapping/', 'momentum/graph-build/') where branch like 'momentum/mapping/%';
update ${s}.agent_metric set automation = 'graph-build' where automation = 'mapping';
delete from ${s}.automation where name = 'mapping';
`;
}

export async function migrateHarness(sql: Sql): Promise<void> {
  await sql.unsafe(HARNESS);
}

export async function migrateWorkspace(sql: Sql, workspace: string): Promise<void> {
  await sql.unsafe(workspaceDdl(schemaOf(workspace)));
}
