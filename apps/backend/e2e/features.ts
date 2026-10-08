/**
 * Every feature of the harness, by area. Each scenario names the features it covers; a coverage test fails while a
 * feature is covered by no scenario.
 */
export const FEATURES = {
  // Projects
  'project.discover': 'Repositories under the workspaces root are listed as projects, disabled until enabled',
  'project.enable': 'Enabling materializes definitions, indexes the main line, proposes default triggers and starts the graph build',
  'project.disable': 'Disabling stops a graph build in progress; enabling again resumes it',
  'project.reset': 'Reset ends runs, removes checkouts, deletes the knowledge graph in one commit, drops the index and builds afresh',
  'project.harness-protected': 'The harness workspace cannot be reset',
  'project.linear': 'A project is one straight line: another branch, a detached HEAD or a merge commit keeps it from being enabled and switches it off',
  'project.churn': 'A repository cloned under the root or removed from it is seen without a restart; a main line other than main is followed',
  'project.dependencies': 'A project with dependencies, a type check and a test suite: runs install into their own checkout and run the checks there; validation raises what fails with what the tools said',
  'project.history': 'A repository with a history of commits keeps it: every landing is one commit on top, nothing is rewritten or merged',

  // Definitions and triggers
  'definition.materialize': 'Harness/Automation artifacts are written to <workspace>/.claude and kept out of git',
  'definition.land': 'A definition as it lands on the harness main line is materialized into every enabled project, whatever its verification',
  'definition.variant': 'A definition variant is recorded on each run of its automation for comparison',
  'definition.review': 'A definition whose files a run changed is in effect as it lands and waits in the feed, unverified, for the user to review',
  'trigger.defaults': 'Default triggers land on the main line, in effect at once, and wait unverified in the feed for review',
  'trigger.in-effect': 'A trigger starts its automation as it lands on the main line, before the user reviews it',
  'trigger.schedule': 'A trigger with a cron schedule queues a run once per due time',
  'trigger.event': 'entity_ahead starts implementation; implementation_finished starts validation',
  'trigger.on-demand': 'An automation with an on-demand trigger can be started by the user',
  'trigger.off': 'A trigger with no schedule, no events and no start on demand starts nothing',

  // Orchestrator
  'orchestrator.feed-room': 'Scheduled loops and the graph build queue only while the feed has room',
  'orchestrator.serial-automations': 'Automation runs of one project go one at a time',
  'orchestrator.parallel-user-runs': 'Runs the user starts go at once, alongside automation runs',
  'orchestrator.concurrent-total': 'The total of active runs across projects never passes the setting',
  'orchestrator.restart-recovery': 'A run lost at restart is queued again, and failed past the limit',

  // Runs
  'run.checkout': 'Each run works in its own checkout of the main line, removed when it ends',
  'run.messages': 'The user posts messages to a running chat and reads its transcript',
  'run.kill': 'A killed run ends as killed; what it wrote so far still lands and reaches the feed',
  'run.context': 'Card parts added to a chat reach the agent as references',
  'run.process-limits': 'Each run process is held to the memory and CPU limits set for runs, in a job its commands run in too',
  'run.usage-share': 'A rise in the account limits, read before, during and after each turn, is split evenly among the runs active at both readings and recorded per run',
  'run.models': 'The model of a run follows the mode: single, per automation, or by risk estimated from the rules',
  'run.queue': 'Runs past the total wait in order; a message to a waiting chat joins its first one; a waiting run stopped never starts',
  'run.retry': 'An implementation that failed is started again on demand for the same entity',
  'run.failure': 'A run the API fails for ends failed with the reason; a chat resumes on the next message; a build failing three times in a row stops',

  // Guard
  'guard.live-check': 'A bad entity write is flagged to the run at once',
  'guard.stop-blocked': 'A run cannot stop while its entities are invalid',
  'guard.land': 'A run lands on the main line in one commit, with its own message or one built from what changed',
  'guard.inconsistent-issue': 'Changes that cannot be made consistent land with an issue raised over them',
  'guard.summarization-checked': "What a run handed its summarization step and the step never saw is summarized after the run lands, not taken as done",
  'guard.harness-scope': "In the harness's own repository a run lands only what its automation may change there; the rest is put back and raised as an issue",
  'guard.main-line-index': 'The main line is indexed on every tick; a user commit is picked up',
  'guard.conflict': "A file a run and the user both changed lands on the run's side, with a Harness/Conflict raised in the same commit over the entities concerned, waiting in the feed",
  'guard.user-checkout': "The user's checkout follows each landing file by file; their uncommitted edits and untracked files are never overwritten",

  // Summary states
  'state.verification': 'Entities are unverified until approved, verified after',
  'state.entity-ahead': 'An approved implementable entity with nothing implementing it is entity_ahead',
  'state.artifact-ahead': 'An artifact changed on the main line puts its entity artifact_ahead and starts one summarization run',
  'state.updating': 'An entity is updating while summarization rewrites it, synced after',
  'state.new-files': 'Files the user adds that no entity summarizes are summarized once the knowledge graph is complete',
  'state.moved-files': 'Renamed, split, moved and deleted files are followed: no entity keeps pointing at a file that is gone',
  'state.summarized-once': 'Artifacts a run summarized itself start no summarization run; a rewrite that changes nothing leaves the entity synced, a failed one artifact_ahead',

  // Feed and approval
  'feed.rank': 'The feed ranks entities across enabled projects by product impact, timeline impact and unlocks, summed; no project comes first, and equal ranks keep the order they came in',
  'feed.size': 'The feed holds at most the configured number of items',
  'feed.approve': 'Approval verifies in place: one commit on the main line, nothing else touched',
  'feed.send-back': 'Send back opens a chat run on the entity with the comment',
  'feed.diff': 'A changed card shows as a diff against its last verified version until approved again',
  'feed.issue-options': 'An issue offers 2-4 options; picking one resolves it in a chat run',
  'feed.wont-resolve': "Won't resolve closes an issue as verified with the reason",
  'feed.contradictions': 'Open contradiction issues over an entity are counted on it',
  'feed.patterns': 'Ten agreeing reactions on one entity type are proposed as a Harness/Pattern in the feed; the pattern counts only once approved',
  'feed.stale': 'A card that changed after the device showed it is not approved unseen',
  'feed.swipes': "Every reaction is made on the card in the app: a swipe right approves, a swipe left sends back with a comment, an issue's option is picked and swiped, the user's own resolution and won't resolve are written in the sheet",
  'feed.card-chat': 'A card pulled up opens a chat below it, the whole card in its context and the card as its target; the card waits on top, and the chat closes when the card changes or is reacted to',
  'feed.once': 'The same reaction from two devices, a second tap or a replayed offline swipe acts once; a send back never starts a second chat',

  // Knowledge base
  'kb.index': 'Entities are parsed, validated and indexed with references in both directions',
  'kb.types': 'Entities are grouped by type path',
  'kb.search': 'Search finds entities by full text and meaning and expands along references',
  'kb.mcp': 'Runs read, search, follow references and write entities through the momentum-kb MCP server',
  'kb.validate': 'Unresolved references, unknown types, path mismatch, mermaid and card links missing from the references are rejected',
  'kb.ask': 'A question in the explorer search is answered in one pass from the entities the search finds, each it draws from linked',

  // Automations, each a real Claude Code run
  'automation.graph-build': 'Builds the knowledge graph run after run, told what the measured completeness finds missing, until complete or stopped',
  'automation.summarization': 'Summarizes the artifacts a run left, handed over by the Stop hook, once',
  'automation.exploration': 'Picks the next best action for the goals and writes research and an action entity; idle when goals are met',
  'automation.preparation': 'Writes plans for startable action points; summarization makes them Harness/Plan entities',
  'automation.implementation': 'Implements an approved entity; the work lands on the main line',
  'automation.validation': 'Validates landed work and raises failures as issues',
  'automation.consistency-check': 'Files each inconsistency as a Harness/Issue with category, severity and options; fixes nothing',
  'automation.retention': 'Removes spent entities by the lifetime rules, keeping what something still references; the harness reports what went',
  'feed.removal-report': "What a run removed shows as a report card in the feed, with the titles the entities had, and on the run's timeline event; nothing to approve",
  'automation.optimization': 'Reads every chat; proposes a Harness/Pattern and a skill, memory, definition or trigger change only for what was seen at least three times',
  'automation.chat': 'Answers from the knowledge base first; a requested plan becomes a Harness/Plan',
  'automation.interview': 'Asks one question at a time, writes answers to one document, summarized once when done',

  // Voice
  'voice.stream': 'The voice stream delivers in order, skips what was seen and resyncs on a hole',
  'voice.routing': 'A spoken item goes where the screen sends it: chat, search, entity or interview',
  'voice.auth': 'Only a signed-in app opens the voice sockets',

  // Metrics
  'metrics.attention': 'Time per item, approved, rejected and sent back are recorded and charted',
  'metrics.understanding': 'Consistency and coverage of the knowledge graph are charted',
  'metrics.implementation': 'Outstanding issues, bugs and defects are charted',
  'metrics.per-automation': 'Runs, time and usage per automation, with histograms',
  'metrics.agent': 'Automations record their own counts with record_agent_metric',

  // Access
  'api.auth': 'A session needs the password; a wrong one is refused',
  'api.http': 'Every route of the OpenAPI document the back-end serves answers with a body its schema accepts, refusals included',
  'api.mcp': 'Every tool of the momentum MCP server works: the feed and its reactions, chats, runs, automations, graph build, reset, settings, metrics and timeline',
  'app.pages': 'Every app page loads and acts on the backend: feed, explorer, entity, chat, timeline, metrics, settings',
  'app.entity-links': "An entity named anywhere (a card's text, a chat, an answer, references, events, issues) shows its type's glyph and colour and opens on a press; references group by type",
  'app.entity-folds': "An entity's references and artifacts are folded until opened",
  'app.appearance': 'The app takes the light or dark palette chosen in Settings, or the system one, on every screen at once, the feed card included',
  'app.offline': 'Swipes made while the back-end is unreachable wait on the device and land once it is back',
  'app.timeline': "The timeline lists the user's actions and one event per run, kept up to date as it runs and lands, newest first, by project and actor, live beside the app in the observer",
  'settings.graph-config': 'Settings lead to the configuration kept in the knowledge graph: automations, entity types, risk rules, triggers and patterns',
  'settings.persist': 'Settings persist: feed size, card limit and rules, exclusions, lifetimes, total runs, models',
} as const;

export type Feature = keyof typeof FEATURES;
