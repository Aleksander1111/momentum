import { z } from 'zod';

// Entity states

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

export const Severity = z.enum(['high', 'medium', 'low']);
export type Severity = z.infer<typeof Severity>;

/** One way to resolve an issue: a short label and one sentence of what it changes */
export const IssueOption = z.object({ label: z.string().min(1), change: z.string().min(1) });
export type IssueOption = z.infer<typeof IssueOption>;

/** Frontmatter extension of a Harness/Issue entity raised by the consistency check */
export const IssueFields = z.object({
  category: z.string().optional(),
  severity: Severity.optional(),
  options: z.array(IssueOption).default([]),
  /** Index of the option that is obviously best, when one is */
  recommended: z.number().int().nonnegative().optional(),
  /** The user's reason when the issue is closed without a change */
  wont_resolve: z.string().optional(),
});
export type IssueFields = z.infer<typeof IssueFields>;

// Card, rendered from the markdown AST; PlantUML is rendered to SVG on the server

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: Inline[] }
  | { t: 'br' }
  | { t: 'ins'; c: Inline[] }
  | { t: 'del'; c: Inline[] };

export const Inline: z.ZodType<Inline> = z.lazy(() =>
  z.discriminatedUnion('t', [
    z.object({ t: z.literal('text'), v: z.string() }),
    z.object({ t: z.literal('strong'), c: z.array(Inline) }),
    z.object({ t: z.literal('em'), c: z.array(Inline) }),
    z.object({ t: z.literal('code'), v: z.string() }),
    z.object({ t: z.literal('link'), href: z.string(), c: z.array(Inline) }),
    z.object({ t: z.literal('br') }),
    z.object({ t: z.literal('ins'), c: z.array(Inline) }),
    z.object({ t: z.literal('del'), c: z.array(Inline) }),
  ]),
);

/** A diff mark: text added or removed since the last verified version */
export const Mark = z.enum(['ins', 'del']);
export type Mark = z.infer<typeof Mark>;

/** A run of source text in a line diff (code, PlantUML source); `eq` is unchanged */
export const Span = z.object({ k: z.enum(['eq', 'ins', 'del']), v: z.string() });
export type Span = z.infer<typeof Span>;

/** A shape of a rendered diagram the user can pick: the SVG group id, how it reads, its box in viewBox units */
export const DiagramElement = z.object({
  id: z.string(),
  name: z.string(),
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});
export type DiagramElement = z.infer<typeof DiagramElement>;

export const RenderedDiagram = z.object({ svg: z.string(), source: z.string(), elements: z.array(DiagramElement).optional() });
export type RenderedDiagram = z.infer<typeof RenderedDiagram>;

/**
 * A card block. In a diff card: `ins`/`del` hold whole blocks added or removed, `marks` mark whole list items and
 * table rows, `diff` is the line diff of code or of a diagram's source, and a changed diagram carries its `before`.
 */
export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'h'; depth: number; c: Inline[] }
  | { t: 'list'; ordered: boolean; items: Block[][]; marks?: (Mark | null)[] }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][]; marks?: (Mark | null)[] }
  | { t: 'code'; lang: string | null; v: string; diff?: Span[] }
  | { t: 'quote'; c: Block[] }
  | { t: 'diagram'; svg: string; source: string; elements?: DiagramElement[]; before?: RenderedDiagram; diff?: Span[] }
  | { t: 'hr' }
  | { t: 'ins'; c: Block[] }
  | { t: 'del'; c: Block[] };

export const Block: z.ZodType<Block> = z.lazy(() =>
  z.discriminatedUnion('t', [
    z.object({ t: z.literal('p'), c: z.array(Inline) }),
    z.object({ t: z.literal('h'), depth: z.number(), c: z.array(Inline) }),
    z.object({ t: z.literal('list'), ordered: z.boolean(), items: z.array(z.array(Block)), marks: z.array(Mark.nullable()).optional() }),
    z.object({
      t: z.literal('table'),
      head: z.array(z.array(Inline)),
      rows: z.array(z.array(z.array(Inline))),
      marks: z.array(Mark.nullable()).optional(),
    }),
    z.object({ t: z.literal('code'), lang: z.string().nullable(), v: z.string(), diff: z.array(Span).optional() }),
    z.object({ t: z.literal('quote'), c: z.array(Block) }),
    z.object({
      t: z.literal('diagram'),
      svg: z.string(),
      source: z.string(),
      elements: z.array(DiagramElement).optional(),
      before: RenderedDiagram.optional(),
      diff: z.array(Span).optional(),
    }),
    z.object({ t: z.literal('hr') }),
    z.object({ t: z.literal('ins'), c: z.array(Block) }),
    z.object({ t: z.literal('del'), c: z.array(Block) }),
  ]),
);

export const Card = z.array(Block);
export type Card = z.infer<typeof Card>;

/**
 * What changed in a card since its last verified version: the card with its changes marked, the title when it changed
 * (marked too), and the words removed and added. None for a verified entity or one never verified.
 */
export const CardDiff = z.object({
  title: z.array(Inline).nullable(),
  card: Card,
  removed: z.number().int().nonnegative(),
  added: z.number().int().nonnegative(),
});
export type CardDiff = z.infer<typeof CardDiff>;

// Entities

export const EntityListItem = z.object({
  workspace: z.string(),
  path: z.string(),
  type: z.string(),
  title: z.string(),
  verification: Verification,
  sync: Sync,
  /** Open contradiction issues the consistency check raised over this entity */
  contradictions: z.number().int().nonnegative(),
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
  diff: CardDiff.nullable().default(null),
  markdown: z.string(),
  references: z.array(ReferenceView),
  artifacts: z.array(ArtifactView),
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

/** A question asked of the knowledge graph, answered in one pass from the entities it finds */
export const AskRequest = z.object({ q: z.string().trim().min(1).max(500) });
export type AskRequest = z.infer<typeof AskRequest>;

export const AskResponse = z.object({
  question: z.string(),
  /** Markdown; entities are linked by path, [title](Domain/Type/name) */
  answer: z.string(),
  /** The entities the answer was drawn from, best first */
  sources: z.array(SearchResult),
});
export type AskResponse = z.infer<typeof AskResponse>;

/** Domain/Type/name…: two capitalised segments, then at least one more */
const ENTITY_PATH = /^[A-Z][A-Za-z0-9]*\/[A-Z][A-Za-z0-9]*(?:\/[^\s/#?]+)+$/;

/**
 * The entity path a link target points at, or null when it points anywhere else (a URL, a file, an anchor). Entities
 * link each other in text by path, [the approval rule](Product/BusinessRule/approval-removes-retired); the path may
 * also be written as its file, knowledge-graph/<path>.md, or with the entity: scheme.
 */
export function entityLinkTarget(href: string): string | null {
  let p = href.trim();
  if (p.startsWith('entity:')) p = p.slice('entity:'.length);
  else if (/^[a-z][a-z0-9+.-]*:/i.test(p)) return null;
  p = p.replace(/^\.?\//, '').replace(/^knowledge-graph\//, '').replace(/\.md$/, '');
  return ENTITY_PATH.test(p) ? p : null;
}

// Feed

export const FeedItem = z.object({
  workspace: z.string(),
  path: z.string(),
  type: z.string(),
  title: z.string(),
  card: Card,
  diff: CardDiff.nullable().default(null),
  verification: Verification,
  sync: Sync,
  contradictions: z.number().int().nonnegative(),
  rank: z.number(),
  /** The card as shown: a reaction carrying it is refused once the card has changed since */
  version: z.string().default(''),
  /** An issue with options to resolve it; the entities it concerns, the one at fault first */
  issue: IssueFields.pick({ category: true, severity: true, options: true, recommended: true })
    .extend({ concerns: z.array(z.string()) })
    .nullable()
    .default(null),
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
  /** The version of the card the user approved, as the feed showed it */
  version: z.string().optional(),
});
export type ApproveRequest = z.infer<typeof ApproveRequest>;

export const SendBackRequest = z.object({
  workspace: z.string(),
  comment: z.string().min(1),
  timeSpentMs: z.number().int().nonnegative(),
});
export type SendBackRequest = z.infer<typeof SendBackRequest>;

/** Resolves an issue with one of its options or with the user's own resolution */
export const ResolveRequest = z
  .object({
    workspace: z.string(),
    option: z.number().int().nonnegative().optional(),
    comment: z.string().min(1).optional(),
    timeSpentMs: z.number().int().nonnegative(),
    /** The version of the issue the user resolved, as the feed showed it */
    version: z.string().optional(),
  })
  .refine((r) => (r.option === undefined) !== (r.comment === undefined), 'Either an option or a comment');
export type ResolveRequest = z.infer<typeof ResolveRequest>;

/** Closes an issue without a change, with the user's reason */
export const WontResolveRequest = SendBackRequest;
export type WontResolveRequest = SendBackRequest;

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
  'chat',
  'graph-build',
  'interview',
  'search',
]);
export type AutomationName = z.infer<typeof AutomationName>;

export const RunTrigger = z.enum(['schedule', 'event', 'on_demand']);
export type RunTrigger = z.infer<typeof RunTrigger>;

export const RunStatus = z.enum(['queued', 'running', 'finished', 'failed', 'killed']);
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

/**
 * A part of a card the user added to a chat's context: a quote of selected text or a picked diagram element, with the
 * entity and the headings it sits under; with neither, the whole card
 */
export const ContextItem = z
  .object({
    workspace: z.string(),
    path: z.string(),
    title: z.string(),
    heading: z.array(z.string()).default([]),
    quote: z.string().min(1).optional(),
    element: z.string().min(1).optional(),
  })
  .refine((c) => c.quote === undefined || c.element === undefined, 'A quote or a diagram element, not both');
export type ContextItem = z.infer<typeof ContextItem>;

export const RunMessage = z.object({
  seq: z.number(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  context: z.array(ContextItem).default([]),
  at: z.string(),
});
export type RunMessage = z.infer<typeof RunMessage>;

/** An interview as its last turn left it: the question it asked, whether it is done, the document it writes */
export const InterviewState = z.object({ question: z.string(), done: z.boolean(), document: z.string() });
export type InterviewState = z.infer<typeof InterviewState>;

export const RunDetail = Run.extend({ messages: z.array(RunMessage), interview: InterviewState.nullable().default(null) });
export type RunDetail = z.infer<typeof RunDetail>;

export const PostRunMessage = z.object({ text: z.string().min(1), context: z.array(ContextItem).default([]) });
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
  context: z.array(ContextItem).default([]),
});
export type CreateChatRequest = z.infer<typeof CreateChatRequest>;

// Voice: speech from the user's devices, transcribed on the PC by the command stream

/** Where the next spoken item goes: the screen the user is on, declared by the app */
export const VoiceTarget = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chat'), workspace: z.string(), runId: z.string().optional(), context: z.array(ContextItem).default([]) }),
  z.object({ kind: z.literal('search'), workspace: z.string() }),
  z.object({ kind: z.literal('entity'), workspace: z.string(), path: z.string() }),
  z.object({ kind: z.literal('interview'), workspace: z.string(), runId: z.string() }),
]);
export type VoiceTarget = z.infer<typeof VoiceTarget>;

/** The app to the control socket */
export const VoiceUp = z.object({ type: z.literal('target'), target: VoiceTarget.nullable() });
export type VoiceUp = z.infer<typeof VoiceUp>;

/** What became of a spoken item */
export const VoiceOutcome = z.object({
  kind: z.enum(['chat', 'search', 'ignored', 'failed']),
  workspace: z.string().optional(),
  runId: z.string().optional(),
  /** A chat started by the item: the app clears the context it carried */
  created: z.boolean().optional(),
  /** The search words */
  text: z.string().optional(),
  detail: z.string().optional(),
});
export type VoiceOutcome = z.infer<typeof VoiceOutcome>;

export const VoiceItem = z.object({ id: z.number(), kind: z.string(), text: z.string() });
export type VoiceItem = z.infer<typeof VoiceItem>;

/** The control socket to the app */
export const VoiceDown = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('status'),
    /** Whether the command stream is reachable */
    connected: z.boolean(),
    ready: z.boolean(),
    source: z.string(),
    muted: z.boolean(),
    text: z.string(),
  }),
  /** The text as heard so far, correcting itself until it is sent; only to the device streaming */
  z.object({ type: z.literal('partial'), text: z.string().nullable(), kind: z.string().nullable() }),
  z.object({ type: z.literal('item'), item: VoiceItem, outcome: VoiceOutcome }),
]);
export type VoiceDown = z.infer<typeof VoiceDown>;

// Graph build: the knowledge graph of a workspace built from its repository

export const GraphBuildState = z.enum(['building', 'stopped', 'complete']);
export type GraphBuildState = z.infer<typeof GraphBuildState>;

export const GraphBuildStatus = z.object({
  workspace: z.string(),
  /** null until the project is enabled for the first time */
  state: GraphBuildState.nullable(),
  /** Progress reported by the last graph build run, given to the next one */
  progress: z.string().nullable(),
  since: z.string().nullable(),
  runs: z.number(),
  /** Entities the graph build runs wrote so far, approved or waiting in the feed */
  entities: z.number(),
  /** Everything the graph build runs used so far */
  usage: Usage,
  /** Time the graph build runs have spent running so far, the run in progress included */
  spentMs: z.number(),
  /** Share of the repository covered, 0–1, as reported by the last run; null until a run reports it */
  coverage: z.number().nullable(),
  /** The full build extrapolated from what the covered share took; null until coverage is reported */
  estimate: z.object({ totalMs: z.number(), usage: Usage }).nullable(),
  activeRunId: z.string().nullable(),
  /** Whether the project can be reset; the harness workspace cannot */
  resettable: z.boolean(),
});
export type GraphBuildStatus = z.infer<typeof GraphBuildStatus>;

export const PutGraphBuild = z.object({ building: z.boolean() });
export type PutGraphBuild = z.infer<typeof PutGraphBuild>;

// Metrics

/** The span the metrics cover: hourly points over a day, or daily points over a week or a month */
export const MetricsRange = z.enum(['24h', '7d', '30d']);
export type MetricsRange = z.infer<typeof MetricsRange>;

/** One point per hour or day of the range, oldest first; null where there is nothing to show, such as an average of nothing */
export const Series = z.array(z.object({ at: z.string(), value: z.number().nullable() }));
export type Series = z.infer<typeof Series>;

/** The figure over the whole range (a total, an average or the latest level) and its points in time */
export const MetricValue = z.object({ value: z.number().nullable(), series: Series });
export type MetricValue = z.infer<typeof MetricValue>;

/** One automation over the range; usage in percentage points of each limit, split among the runs running together */
export const AutomationMetrics = z.object({
  automation: AutomationName,
  variant: z.string().nullable(),
  runs: MetricValue,
  failed: MetricValue,
  /** Mean time from start to end of the runs that ended */
  avgSeconds: MetricValue,
  usage: z.object({ fiveHour: MetricValue, week: MetricValue }),
  /** What the automation used within the rolling 5 hours and week, the windows of the limits */
  rolling: Usage,
});
export type AutomationMetrics = z.infer<typeof AutomationMetrics>;

/** Runs that ended in the range, counted per bin of one parameter: bin i holds values from edges[i] up to edges[i + 1] */
export const Histogram = z.object({
  edges: z.array(z.number()),
  automations: z.array(z.object({ automation: AutomationName, counts: z.array(z.number()) })),
});
export type Histogram = z.infer<typeof Histogram>;

/** How the parameters of single runs are distributed; usage in percentage points of each limit, time in seconds */
export const RunHistograms = z.object({ fiveHour: Histogram, week: Histogram, seconds: Histogram, messages: Histogram });
export type RunHistograms = z.infer<typeof RunHistograms>;

export const MetricsResponse = z.object({
  workspace: z.string(),
  range: MetricsRange,
  since: z.string(),
  /** The account's share of each limit: the latest reading and the readings over the range */
  usage: z.object({ fiveHour: MetricValue, week: MetricValue }),
  attention: z.object({
    timePerItemSeconds: MetricValue,
    approved: MetricValue,
    rejected: MetricValue,
    sentBack: MetricValue,
    patternsAutomated: MetricValue,
  }),
  understanding: z.object({
    consistency: MetricValue,
    openIssues: MetricValue,
  }),
  agents: z.object({
    misalignments: MetricValue,
    recurringIssues: MetricValue,
    runs: MetricValue,
    /** Each automation that ran or used anything in the range, the most used first */
    automations: z.array(AutomationMetrics),
    runHistograms: RunHistograms,
  }),
  /** Entities standing at the end of each point, per state: the latest count and the counts over the range */
  entities: z.object({
    verification: z.record(Verification, MetricValue),
    sync: z.record(Sync, MetricValue),
  }),
  implementation: z.object({
    outstandingIssues: MetricValue,
    bugs: MetricValue,
    defects: MetricValue,
  }),
});
export type MetricsResponse = z.infer<typeof MetricsResponse>;

// Settings

export const LifetimeRule = z.object({
  type: z.string().min(1),
  rule: z.string().min(1),
});
export type LifetimeRule = z.infer<typeof LifetimeRule>;

/** A project logo as a data URL: a PNG, JPEG, WebP or SVG image of at most 256 KB */
export const LOGO_MAX_BYTES = 256 * 1024;
export const ProjectLogo = z
  .string()
  .regex(/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/, 'A logo is a PNG, JPEG, WebP or SVG image')
  .max(Math.ceil(LOGO_MAX_BYTES / 3) * 4 + 30, 'A logo is at most 256 KB');

export const ProjectSetting = z.object({
  name: z.string(),
  path: z.string(),
  enabled: z.boolean(),
  /** The uploaded logo; none means the app draws one from the name */
  logo: ProjectLogo.nullable(),
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
  /** Path patterns summarization never summarizes, relative to the repository root */
  summarization: z.object({
    exclude: z.array(z.string().min(1)),
  }),
  lifetimes: z.array(LifetimeRule),
  /** Automation runs go one at a time per project, so their changes never conflict; runs the user starts go at once */
  agents: z.object({
    concurrentTotal: z.number().int().positive(),
  }),
  models: ModelSettings,
  /**
   * Where the rest of the configuration lives: the harness workspace, whose knowledge graph holds the automation
   * definitions, the entity types and the patterns of the user's behaviour, each changed and approved as an entity
   */
  harness: z.object({ workspace: z.string() }),
});
export type Settings = z.infer<typeof Settings>;

export const PutSettings = Settings.omit({ harness: true }).partial().extend({
  projects: z.array(ProjectSetting.pick({ name: true, enabled: true })).optional(),
});
export type PutSettings = z.infer<typeof PutSettings>;

// Timeline: what happened in the harness, newest first

/** Who did it: the user, an automation run, or the harness itself */
export const TimelineActor = z.enum(['user', 'automation', 'harness']);
export type TimelineActor = z.infer<typeof TimelineActor>;

export const TimelineKind = z.enum([
  // The user
  'signed_in',
  'sign_in_failed',
  'signed_out',
  'approved',
  'sent_back',
  'resolved',
  'wont_resolve',
  'chat_started',
  'message_sent',
  'interview_started',
  'graph_build_started',
  'graph_build_stopped',
  'project_enabled',
  'project_disabled',
  'project_reset',
  'logo_changed',
  'settings_changed',
  // Automation runs
  'run_queued',
  'run_started',
  'run_resumed',
  'run_requeued',
  'run_finished',
  'run_failed',
  'run_killed',
  'changes_landed',
  // The harness
  'graph_build_complete',
]);
export type TimelineKind = z.infer<typeof TimelineKind>;

/** What an event carries beyond its title, each where it applies */
export const TimelineFacts = z
  .object({
    trigger: RunTrigger,
    status: RunStatus,
    model: z.string(),
    risk: Risk,
    durationMs: z.number(),
    usage: Usage,
    commit: z.string(),
    /** Entities the event wrote or concerns */
    paths: z.array(z.string()),
    issues: z.number().int(),
    conflicts: z.array(z.string()),
    /** Time the user spent on a feed item before reacting */
    timeSpentMs: z.number(),
    /** Settings the user changed, by name */
    changed: z.array(z.string()),
    /** A run's own title, such as a chat's question */
    runTitle: z.string(),
    /** The first line of the commit message of what a run landed: what it did */
    subject: z.string(),
    /** A run the user stopped */
    byUser: z.boolean(),
  })
  .partial();
export type TimelineFacts = z.infer<typeof TimelineFacts>;

export const TimelineEvent = z.object({
  id: z.number().int(),
  at: z.string(),
  /** None for what concerns no one project, such as signing in */
  workspace: z.string().nullable(),
  actor: TimelineActor,
  kind: TimelineKind,
  title: z.string(),
  /** A comment, an error, a commit message: shown when the event is opened */
  detail: z.string().nullable(),
  runId: z.string().nullable(),
  /** The automation of the run, by name */
  automation: z.string().nullable(),
  /** The entity the event concerns */
  path: z.string().nullable(),
  facts: TimelineFacts,
});
export type TimelineEvent = z.infer<typeof TimelineEvent>;

export const TimelineQuery = z.object({
  workspace: z.string().optional(),
  actor: TimelineActor.optional(),
  /** Events older than this id: the `next` of the page before */
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type TimelineQuery = z.infer<typeof TimelineQuery>;

export const TimelineResponse = z.object({
  events: z.array(TimelineEvent),
  /** The `before` of the next, older page; none at the first event */
  next: z.number().int().nullable(),
});
export type TimelineResponse = z.infer<typeof TimelineResponse>;

// Session

export const SessionRequest = z.object({ password: z.string().min(1) });
export type SessionRequest = z.infer<typeof SessionRequest>;

export const SessionResponse = z.object({ token: z.string(), expiresAt: z.string() });
export type SessionResponse = z.infer<typeof SessionResponse>;

export const PutProjectLogo = z.object({ logo: ProjectLogo });
export type PutProjectLogo = z.infer<typeof PutProjectLogo>;

export const Workspace = ProjectSetting;
export type Workspace = z.infer<typeof Workspace>;

export const ErrorResponse = z.object({ error: z.string() });
