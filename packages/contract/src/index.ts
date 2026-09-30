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

export const FeedResponse = z.object({ items: z.array(FeedItem) });
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
]);
export type AutomationName = z.infer<typeof AutomationName>;

export const RunTrigger = z.enum(['schedule', 'event', 'on_demand']);
export type RunTrigger = z.infer<typeof RunTrigger>;

export const RunStatus = z.enum(['queued', 'running', 'finished', 'failed', 'killed', 'held']);
export type RunStatus = z.infer<typeof RunStatus>;

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

// Metrics, SPEC.md → Index and metrics database

export const Series = z.array(z.object({ at: z.string(), value: z.number() }));
export type Series = z.infer<typeof Series>;

export const MetricValue = z.object({ value: z.number(), series: Series });
export type MetricValue = z.infer<typeof MetricValue>;

export const MetricsResponse = z.object({
  workspace: z.string(),
  since: z.string(),
  usage: z.object({
    fiveHour: z.number().nullable(),
    week: z.number().nullable(),
  }),
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
