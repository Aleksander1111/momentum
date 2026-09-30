import { z } from 'zod';

// Entity states, SPEC.md → Database → entity

export const Verification = z.enum(['unverified', 'verified']);
export type Verification = z.infer<typeof Verification>;

export const Sync = z.enum(['synced', 'entity_ahead', 'artifact_ahead', 'updating']);
export type Sync = z.infer<typeof Sync>;

export const Origin = z.enum(['user', 'requested', 'automation']);
export type Origin = z.infer<typeof Origin>;

export const Impact = z.number().int().min(0).max(5);

export const Reference = z.object({
  to: z.string().min(1),
  relation: z.string().min(1),
});
export type Reference = z.infer<typeof Reference>;

/** Frontmatter of an entity file at knowledge-graph/<type path>/<name>.md */
export const EntityFrontmatter = z
  .object({
    type: z.string().min(1),
    origin: Origin.default('automation'),
    verification: Verification.default('unverified'),
    sync: Sync.default('synced'),
    product_impact: Impact.default(0),
    timeline_impact: Impact.default(0),
    unlocks: Impact.default(0),
    references: z.array(Reference).default([]),
    artifacts: z.array(z.string().min(1)).default([]),
  })
  .loose();
export type EntityFrontmatter = z.infer<typeof EntityFrontmatter>;

/** Frontmatter extension of a Harness/Trigger entity */
export const TriggerFields = z.object({
  schedule: z.string().optional(),
  events: z.array(z.string()).default([]),
  on_demand: z.boolean().default(false),
});
export type TriggerFields = z.infer<typeof TriggerFields>;

// Card, rendered from the markdown AST; mermaid is rendered to SVG on the server

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: Inline[] }
  | { t: 'br' };

export const Inline: z.ZodType<Inline> = z.lazy(() =>
  z.discriminatedUnion('t', [
    z.object({ t: z.literal('text'), v: z.string() }),
    z.object({ t: z.literal('strong'), c: z.array(Inline) }),
    z.object({ t: z.literal('em'), c: z.array(Inline) }),
    z.object({ t: z.literal('code'), v: z.string() }),
    z.object({ t: z.literal('link'), href: z.string(), c: z.array(Inline) }),
    z.object({ t: z.literal('br') }),
  ]),
);

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'h'; depth: number; c: Inline[] }
  | { t: 'list'; ordered: boolean; items: Block[][] }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'code'; lang: string | null; v: string }
  | { t: 'quote'; c: Block[] }
  | { t: 'diagram'; svg: string; source: string }
  | { t: 'hr' };

export const Block: z.ZodType<Block> = z.lazy(() =>
  z.discriminatedUnion('t', [
    z.object({ t: z.literal('p'), c: z.array(Inline) }),
    z.object({ t: z.literal('h'), depth: z.number(), c: z.array(Inline) }),
    z.object({ t: z.literal('list'), ordered: z.boolean(), items: z.array(z.array(Block)) }),
    z.object({ t: z.literal('table'), head: z.array(z.array(Inline)), rows: z.array(z.array(z.array(Inline))) }),
    z.object({ t: z.literal('code'), lang: z.string().nullable(), v: z.string() }),
    z.object({ t: z.literal('quote'), c: z.array(Block) }),
    z.object({ t: z.literal('diagram'), svg: z.string(), source: z.string() }),
    z.object({ t: z.literal('hr') }),
  ]),
);

export const Card = z.array(Block);
export type Card = z.infer<typeof Card>;

// Entities

export const EntityListItem = z.object({
  workspace: z.string(),
  path: z.string(),
  type: z.string(),
  title: z.string(),
  verification: Verification,
  sync: Sync,
});
export type EntityListItem = z.infer<typeof EntityListItem>;

export const ReferenceView = z.object({
  path: z.string(),
  relation: z.string(),
  direction: z.enum(['out', 'in']),
  title: z.string().nullable(),
  type: z.string().nullable(),
});
export type ReferenceView = z.infer<typeof ReferenceView>;

export const ArtifactView = z.object({
  path: z.string(),
  kind: z.string(),
});
export type ArtifactView = z.infer<typeof ArtifactView>;

export const EntityDetail = EntityListItem.extend({
  origin: Origin,
  card: Card,
  markdown: z.string(),
  references: z.array(ReferenceView),
  artifacts: z.array(ArtifactView),
  branch: z.string().nullable(),
});
export type EntityDetail = z.infer<typeof EntityDetail>;

export type TypeNode = { name: string; path: string; count: number; children: TypeNode[]; entities: EntityListItem[] };
export const TypeNode: z.ZodType<TypeNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    count: z.number(),
    children: z.array(TypeNode),
    entities: z.array(EntityListItem),
  }),
);

export const TypesResponse = z.object({
  workspace: z.string(),
  total: z.number(),
  types: z.array(TypeNode),
});
export type TypesResponse = z.infer<typeof TypesResponse>;

export const SearchResult = EntityListItem.extend({ score: z.number() });
export type SearchResult = z.infer<typeof SearchResult>;

// Feed

export const FeedItem = z.object({
  workspace: z.string(),
  path: z.string(),
  type: z.string(),
  title: z.string(),
  card: Card,
  verification: Verification,
  sync: Sync,
  rank: z.number(),
});
export type FeedItem = z.infer<typeof FeedItem>;

/** Entities of the enabled projects counted by state, verification and sync alike. */
export const FeedCounts = z.object({
  verification: z.record(Verification, z.number().int().nonnegative()),
  sync: z.record(Sync, z.number().int().nonnegative()),
});
export type FeedCounts = z.infer<typeof FeedCounts>;

export const FeedResponse = z.object({ items: z.array(FeedItem), counts: FeedCounts });
export type FeedResponse = z.infer<typeof FeedResponse>;

export const ApproveRequest = z.object({
  workspace: z.string(),
  timeSpentMs: z.number().int().nonnegative(),
});
export type ApproveRequest = z.infer<typeof ApproveRequest>;

export const SendBackRequest = z.object({
  workspace: z.string(),
  comment: z.string().min(1),
  timeSpentMs: z.number().int().nonnegative(),
});
export type SendBackRequest = z.infer<typeof SendBackRequest>;

// Runs and chats

export const AutomationName = z.enum([
  'exploration',
  'preparation',
  'consistency-check',
  'retention',
  'implementation',
  'validation',
  'optimization',
  'summarization',
  'card',
  'chat',
  'mapping',
]);
export type AutomationName = z.infer<typeof AutomationName>;

export const RunTrigger = z.enum(['schedule', 'event', 'on_demand']);
export type RunTrigger = z.infer<typeof RunTrigger>;

export const RunStatus = z.enum(['queued', 'running', 'finished', 'failed', 'killed', 'held']);
export type RunStatus = z.infer<typeof RunStatus>;

/** Share of the rolling 5-hour and weekly limits, in percentage points */
export const Usage = z.object({
  fiveHour: z.number().nullable(),
  week: z.number().nullable(),
});
export type Usage = z.infer<typeof Usage>;

export const Run = z.object({
  id: z.string(),
  workspace: z.string(),
  automation: AutomationName,
  branch: z.string(),
  checkout: z.string(),
  trigger: RunTrigger,
  targetPath: z.string().nullable(),
  status: RunStatus,
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  error: z.string().nullable(),
  /** What the run has used so far, read from Claude Code while it runs and when it ends */
  usage: Usage,
});
export type Run = z.infer<typeof Run>;

export const RunMessage = z.object({
  seq: z.number(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  at: z.string(),
});
export type RunMessage = z.infer<typeof RunMessage>;

export const RunDetail = Run.extend({ messages: z.array(RunMessage) });
export type RunDetail = z.infer<typeof RunDetail>;

export const PostRunMessage = z.object({ text: z.string().min(1) });
export type PostRunMessage = z.infer<typeof PostRunMessage>;

export const ChatListItem = z.object({
  workspace: z.string(),
  runId: z.string(),
  title: z.string(),
  automation: AutomationName,
  status: RunStatus,
  updatedAt: z.string(),
  entityPath: z.string().nullable(),
  verification: Verification.nullable(),
  sync: Sync.nullable(),
});
export type ChatListItem = z.infer<typeof ChatListItem>;

export const ChatsResponse = z.object({ chats: z.array(ChatListItem) });
export type ChatsResponse = z.infer<typeof ChatsResponse>;

export const CreateChatRequest = z.object({
  text: z.string().min(1),
  targetPath: z.string().optional(),
});
export type CreateChatRequest = z.infer<typeof CreateChatRequest>;

// Mapping: the knowledge graph of a workspace built from its repository

export const MappingState = z.enum(['building', 'stopped', 'complete']);
export type MappingState = z.infer<typeof MappingState>;

export const MappingStatus = z.object({
  workspace: z.string(),
  /** null until the project is enabled for the first time */
  state: MappingState.nullable(),
  /** Progress reported by the last mapping run, given to the next one */
  progress: z.string().nullable(),
  since: z.string().nullable(),
  runs: z.number(),
  /** Entities the mapping runs wrote so far, approved or waiting in the feed */
  entities: z.number(),
  /** Everything the mapping runs used so far */
  usage: Usage,
  /** Time the mapping runs have spent running so far, the run in progress included */
  spentMs: z.number(),
  /** Share of the repository covered, 0–1, as reported by the last run; null until a run reports it */
  coverage: z.number().nullable(),
  /** The full build extrapolated from what the covered share took; null until coverage is reported */
  estimate: z.object({ totalMs: z.number(), usage: Usage }).nullable(),
  activeRunId: z.string().nullable(),
  /** Whether the project can be reset; the harness workspace cannot */
  resettable: z.boolean(),
});
export type MappingStatus = z.infer<typeof MappingStatus>;

export const PutMapping = z.object({ building: z.boolean() });
export type PutMapping = z.infer<typeof PutMapping>;

// Metrics, SPEC.md → Index and metrics database

export const Series = z.array(z.object({ at: z.string(), value: z.number() }));
export type Series = z.infer<typeof Series>;

export const MetricValue = z.object({ value: z.number(), series: Series });
export type MetricValue = z.infer<typeof MetricValue>;

export const MetricsResponse = z.object({
  workspace: z.string(),
  since: z.string(),
  usage: Usage,
  attention: z.object({
    timePerItemSeconds: MetricValue,
    approved: MetricValue,
    rejected: MetricValue,
    sentBack: MetricValue,
    patternsAutomated: z.number(),
  }),
  understanding: z.object({
    consistency: MetricValue,
    openIssues: MetricValue,
  }),
  agents: z.object({
    misalignments: MetricValue,
    recurringIssues: MetricValue,
    runsThisWeek: MetricValue,
    variants: z.array(z.object({ automation: z.string(), variant: z.string() })),
  }),
  implementation: z.object({
    outstandingIssues: MetricValue,
    bugs: MetricValue,
    defects: MetricValue,
  }),
});
export type MetricsResponse = z.infer<typeof MetricsResponse>;

// Settings, PLAN.md → Harness settings

export const LifetimeRule = z.object({
  type: z.string().min(1),
  rule: z.string().min(1),
});
export type LifetimeRule = z.infer<typeof LifetimeRule>;

export const ProjectSetting = z.object({
  name: z.string(),
  path: z.string(),
  enabled: z.boolean(),
});
export type ProjectSetting = z.infer<typeof ProjectSetting>;

/** A Claude model by alias, so it follows the latest version; default leaves the choice to Claude Code */
export const ModelChoice = z.enum(['default', 'fable', 'opus', 'sonnet', 'haiku']);
export type ModelChoice = z.infer<typeof ModelChoice>;

/** How runs get their model: one for all, one per automation, or by the risk estimated before an implementation */
export const ModelMode = z.enum(['single', 'per_automation', 'risk']);
export type ModelMode = z.infer<typeof ModelMode>;

export const Risk = z.enum(['low', 'medium', 'high']);
export type Risk = z.infer<typeof Risk>;

export const ModelSettings = z.object({
  mode: ModelMode,
  single: ModelChoice,
  /** Used in per_automation mode, and in risk mode by every automation but implementation */
  perAutomation: z.record(AutomationName, ModelChoice),
  /** Implementation runs in risk mode, by the risk estimated from automations/implementation/risk.md */
  risk: z.record(Risk, ModelChoice),
});
export type ModelSettings = z.infer<typeof ModelSettings>;

export const Settings = z.object({
  projects: z.array(ProjectSetting),
  feedSize: z.number().int().positive(),
  cards: z.object({
    characterLimit: z.number().int().positive(),
    presentationRules: z.string(),
  }),
  lifetimes: z.array(LifetimeRule),
  agents: z.object({
    concurrentPerProject: z.number().int().positive(),
    concurrentTotal: z.number().int().positive(),
  }),
  models: ModelSettings,
});
export type Settings = z.infer<typeof Settings>;

export const PutSettings = Settings.partial().extend({
  projects: z.array(ProjectSetting.pick({ name: true, enabled: true })).optional(),
});
export type PutSettings = z.infer<typeof PutSettings>;

// Session

export const SessionRequest = z.object({ password: z.string().min(1) });
export type SessionRequest = z.infer<typeof SessionRequest>;

export const SessionResponse = z.object({ token: z.string(), expiresAt: z.string() });
export type SessionResponse = z.infer<typeof SessionResponse>;

export const Workspace = z.object({ name: z.string(), path: z.string(), enabled: z.boolean() });
export type Workspace = z.infer<typeof Workspace>;

export const ErrorResponse = z.object({ error: z.string() });
