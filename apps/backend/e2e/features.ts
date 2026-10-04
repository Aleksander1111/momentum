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
  'project.main-line': 'A developer working on another branch in the project leaves the main line where it is, across restarts; merging the branch is indexed',
  'project.churn': 'A repository cloned under the root or removed from it is seen without a restart; a main line other than main is followed',

  // Definitions and triggers
  'definition.materialize': 'Approved Harness/Automation artifacts are written to <workspace>/.claude and kept out of git',
  'definition.approve': 'Approving a definition in the harness workspace materializes it into every enabled project',
  'definition.variant': 'A definition variant is recorded on each run of its automation for comparison',
  'definition.review': 'A definition whose files a run changed lands unverified and is not materialized until approved',
  'trigger.defaults': 'Default triggers land on the main line unverified and wait in the feed',
  'trigger.schedule': 'An approved trigger with a cron schedule queues a run once per due time',
  'trigger.event': 'entity_ahead starts implementation; implementation_finished starts validation',
  'trigger.on-demand': 'An automation with an on-demand trigger can be started by the user',
  'trigger.unverified-ignored': 'A trigger not yet approved starts nothing',

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
  'run.process-limits': 'Each run process is held to CPU and memory limits',
  'run.usage-share': 'A rise in the account limits is split among the runs active at both readings and recorded per run',
  'run.models': 'The model of a run follows the mode: single, per automation, or by risk estimated from the rules',
  'run.queue': 'Runs past the total wait in order; a message to a waiting chat joins its first one; a waiting run stopped never starts',
  'run.retry': 'An implementation that failed is started again on demand for the same entity',
  'run.developer-work': "A developer's uncommitted work in the project survives a run landing in the same file, merged with it",
  'run.failure': 'A run the API fails for ends failed with the reason; a chat resumes on the next message; a build failing three times in a row stops',

  // Guard
  'guard.live-check': 'A bad entity write is flagged to the run at once',
  'guard.stop-blocked': 'A run cannot stop while its entities are invalid',
  'guard.land': 'A run lands on the main line in one commit, with its own message or one built from what changed',
  'guard.inconsistent-issue': 'Changes that cannot be made consistent land with an issue raised over them',
  'guard.conflict': 'A run conflicting with the main line lands on the run side and raises the conflict',
  'guard.main-line-index': 'The main line is indexed on every tick; a user commit is picked up',

  // Summary states
  'state.verification': 'Entities are unverified until approved, verified after',
  'state.entity-ahead': 'An approved implementable entity with nothing implementing it is entity_ahead',
  'state.artifact-ahead': 'An artifact changed on the main line puts its entity artifact_ahead and starts one summarization run',
  'state.updating': 'An entity is updating while summarization rewrites it, synced after',
  'state.new-files': 'Files a developer adds that no entity summarizes are summarized once the knowledge graph is complete',
  'state.merges': 'Pull requests merged one after another are summarized one run each, in order, the cards ending on the latest',
  'state.moved-files': 'Renamed, split, moved and deleted files are followed: no entity keeps pointing at a file that is gone',
  'state.summarized-once': 'Artifacts a run summarized itself start no summarization run; a rewrite that changes nothing leaves the entity synced, a failed one artifact_ahead',

  // Feed and approval
  'feed.rank': 'The feed ranks entities across enabled projects by impact, unlocks and contradictions',
  'feed.size': 'The feed holds at most the configured number of items',
  'feed.approve': 'Approval verifies in place: one commit on the main line, nothing else touched',
  'feed.send-back': 'Send back opens a chat run on the entity with the comment',
  'feed.diff': 'A changed card shows as a diff against its last verified version until approved again',
  'feed.issue-options': 'An issue offers 2-4 options; picking one resolves it in a chat run',
  'feed.wont-resolve': "Won't resolve closes an issue as verified with the reason",
  'feed.contradictions': 'Open contradiction issues over an entity are counted on it',
  'feed.patterns': 'Ten agreeing reactions on one entity type become an automatic approval or rejection pattern',
  'feed.stale': 'A card that changed after the device showed it is not approved unseen',
  'feed.once': 'The same reaction from two devices, a second tap or a replayed offline swipe acts once; a send back never starts a second chat',
  'feed.retire': 'Approving a retirement removes what nothing else references, and the plan with it',

  // Knowledge base
  'kb.index': 'Entities are parsed, validated and indexed with references in both directions',
  'kb.types': 'Entities are grouped by type path',
  'kb.search': 'Search finds entities by full text and meaning and expands along references',
  'kb.mcp': 'Runs read, search, follow references and write entities through the momentum-kb MCP server',
  'kb.validate': 'Card limit, unresolved references, unknown types, path mismatch and mermaid are rejected',

  // Automations, each a real Claude Code run
  'automation.graph-build': 'Builds the knowledge graph run after run, reporting progress and coverage, until covered or stopped',
  'automation.summarization': 'Summarizes the artifacts a run left, handed over by the Stop hook, once',
  'automation.exploration': 'Picks the next best action for the goals and writes research and an action entity; idle when goals are met',
  'automation.preparation': 'Writes plans for startable action points; summarization makes them Harness/Plan entities',
  'automation.implementation': 'Implements an approved entity; the work lands on the main line',
  'automation.validation': 'Validates landed work and raises failures as issues',
  'automation.consistency-check': 'Files each inconsistency as a Harness/Issue with category, severity and options; fixes nothing',
  'automation.retention': 'Proposes one retirement plan per group of spent entities; approval removes them',
  'automation.optimization': 'Counts misalignments and recurring issues and proposes definition or trigger changes',
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
  'api.http': 'Every HTTP route answers to its contract',
  'api.mcp': 'The momentum MCP server drives the feed, chats, automations, graph build and reset',
  'app.pages': 'Every app page loads and acts on the backend: feed, explorer, entity, chat, timeline, metrics, settings',
  'app.offline': 'Swipes made while the back-end is unreachable wait on the device and land once it is back',
  'app.timeline': "The timeline lists the user's actions and one event per run, kept up to date as it runs and lands, newest first, by project and actor, live beside the app in the observer",
  'settings.persist': 'Settings persist: feed size, card limit and rules, exclusions, lifetimes, total runs, models',

  // Legacy
  'legacy.run-branches': 'momentum/ branches from before the main line are landed oldest first and removed',
} as const;

export type Feature = keyof typeof FEATURES;
