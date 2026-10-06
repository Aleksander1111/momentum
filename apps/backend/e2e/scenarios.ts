import type { Feature } from './features.ts';

/**
 * End-to-end scenarios over the example projects in examples/. Each runs in isolation: its own workspaces root, its
 * own database, a fresh copy of its example project and of the harness definitions. A `real` scenario starts real
 * Claude Code runs and is skipped once the account's 5-hour or weekly limit is used up, to be continued once it resets.
 */
export interface Scenario {
  id: string;
  title: string;
  projects: ('todo-cli' | 'bookshelf-api' | 'handbook' | 'notes-api')[];
  real: boolean;
  /** Runs talk to a scripted model: real Claude Code and harness, with the model's moves set by the scenario */
  scripted?: boolean;
  covers: Feature[];
  steps: string[];
  /** The features each step checks, one list per step: a failing step fails only these */
  checks: Feature[][];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'onboard',
    title: 'Onboard a code-only project',
    projects: ['todo-cli'],
    real: true,
    covers: [
      'project.discover', 'project.enable', 'definition.materialize', 'trigger.defaults', 'trigger.unverified-ignored',
      'automation.graph-build', 'orchestrator.feed-room', 'feed.size', 'feed.approve', 'state.verification',
      'kb.index', 'kb.types', 'kb.validate', 'run.checkout', 'run.usage-share', 'run.process-limits', 'automation.summarization',
    ],
    steps: [
      'Project listed disabled; enabling it materializes the definitions and proposes the default triggers',
      'No trigger starts anything while unverified',
      'Graph build runs until the feed is full, pauses, and continues as items are approved',
      'Build reports coverage each run and ends complete; every written entity is valid and typed',
      'Each run records its usage share and leaves no checkout behind',
    ],
    // The features each step checks, step by step
    checks: [
      ['project.discover', 'project.enable', 'definition.materialize', 'trigger.defaults', 'state.verification'],
      ['trigger.unverified-ignored'],
      ['automation.graph-build', 'orchestrator.feed-room', 'feed.size', 'feed.approve'],
      ['automation.graph-build', 'kb.index', 'kb.types', 'kb.validate', 'automation.summarization'],
      ['run.checkout', 'run.usage-share', 'run.process-limits'],
    ],
  },
  {
    id: 'goal-to-landed-work',
    title: 'From a goal to validated work on the main line',
    projects: ['bookshelf-api'],
    real: true,
    covers: [
      'trigger.schedule', 'trigger.event', 'automation.exploration', 'automation.preparation', 'automation.summarization',
      'automation.implementation', 'automation.validation', 'state.entity-ahead', 'guard.land', 'orchestrator.serial-automations',
      'kb.mcp', 'kb.search',
    ],
    steps: [
      'Exploration reads the goals and writes research plus an action entity that advances a goal',
      'Approving the action makes it entity_ahead; preparation writes a plan, summarization makes it a Harness/Plan',
      'Approving the plan starts implementation; its work lands on the main line in one commit',
      'implementation_finished starts validation; the seeded failing test ends fixed on the main line or raised as an issue',
      'Automation runs never overlap within the project',
    ],
    // The features each step checks, step by step
    checks: [
      ['trigger.schedule', 'automation.exploration', 'kb.mcp', 'kb.search'],
      ['state.entity-ahead', 'automation.preparation', 'automation.summarization'],
      ['automation.implementation', 'guard.land', 'trigger.event'],
      ['automation.validation', 'trigger.event'],
      ['orchestrator.serial-automations'],
    ],
  },
  {
    id: 'exploration-idle',
    title: 'Exploration stays idle when every goal is met',
    projects: ['todo-cli'],
    real: true,
    covers: ['automation.exploration'],
    steps: ['With every goal marked met, a scheduled exploration run writes nothing'],
    // The features each step checks, step by step
    checks: [
      ['automation.exploration'],
    ],
  },
  {
    id: 'consistency',
    title: 'Inconsistencies raised, resolved and dismissed',
    projects: ['handbook'],
    real: true,
    covers: [
      'automation.consistency-check', 'feed.issue-options', 'feed.wont-resolve', 'feed.contradictions', 'automation.chat',
      'feed.diff',
    ],
    steps: [
      'Consistency check files the seeded contradiction and naming clash as issues with options; changes no entity',
      'The contradicted entity counts the open contradiction',
      'Picking an option starts a chat run that fixes the entity; the card shows a diff until approved',
      "Won't resolve closes the other issue with the reason",
    ],
    // The features each step checks, step by step
    checks: [
      ['automation.consistency-check', 'feed.issue-options'],
      ['feed.contradictions'],
      ['automation.chat', 'feed.issue-options', 'feed.diff'],
      ['feed.wont-resolve'],
    ],
  },
  {
    id: 'retention',
    title: 'Spent entities retired',
    projects: ['handbook'],
    real: true,
    covers: ['automation.retention', 'feed.approve'],
    steps: [
      'Retention proposes one plan retiring the old unreferenced DevTask and research; keeps the referenced decision and goals',
      'Approving the plan removes them from the main line',
    ],
    // The features each step checks, step by step
    checks: [
      ['automation.retention'],
      ['automation.retention', 'feed.approve'],
    ],
  },
  {
    id: 'chat-and-send-back',
    title: 'Chat, send back and a requested plan',
    projects: ['bookshelf-api'],
    real: true,
    covers: ['automation.chat', 'feed.send-back', 'run.messages', 'run.context', 'run.kill', 'automation.summarization'],
    steps: [
      'A chat answers a question from the knowledge base with the card parts added as context',
      'A follow-up message continues the same run; the transcript is summarized into a chat entity',
      'Send back with a comment changes the entity in a chat run; the changed entity waits in the feed again',
      'A chat asked for a plan writes plans/<name>.md, summarized into a Harness/Plan',
      'A killed chat ends killed; what it wrote so far reaches the feed',
    ],
    // The features each step checks, step by step
    checks: [
      ['automation.chat', 'run.context', 'run.messages'],
      ['run.messages', 'automation.summarization'],
      ['feed.send-back'],
      ['automation.chat', 'automation.summarization'],
      ['run.kill'],
    ],
  },
  {
    id: 'artifact-change',
    title: 'A user edit to an artifact resummarized',
    projects: ['handbook'],
    real: true,
    covers: ['guard.main-line-index', 'state.artifact-ahead', 'state.updating', 'automation.summarization', 'settings.persist'],
    steps: [
      'A user commit on the main line changes a summarized document and one in an excluded path',
      'Its entity goes artifact_ahead, then updating, and one summarization run rewrites the card; synced after',
      'The excluded document is never summarized',
    ],
    // The features each step checks, step by step
    checks: [
      ['settings.persist', 'guard.main-line-index'],
      ['guard.main-line-index', 'state.artifact-ahead', 'state.updating', 'automation.summarization'],
      ['automation.summarization', 'settings.persist'],
    ],
  },
  {
    id: 'interview',
    title: 'Interview by voice',
    projects: ['bookshelf-api'],
    real: true,
    covers: ['automation.interview', 'voice.routing', 'voice.stream'],
    steps: [
      '"Interview <topic>" spoken with the chat screen open starts an interview run',
      'Answers, a skip and a question back each land in one document under interviews/',
      '"Stop interview" ends it; the document is summarized into entities once',
    ],
    // The features each step checks, step by step
    checks: [
      ['automation.interview', 'voice.routing'],
      ['automation.interview', 'voice.stream', 'voice.routing'],
      ['automation.interview'],
    ],
  },
  {
    id: 'optimization',
    title: 'Optimization proposes from recurring issues',
    projects: ['bookshelf-api'],
    real: true,
    covers: ['automation.optimization', 'metrics.agent', 'definition.approve', 'definition.variant'],
    steps: [
      'Two chats repeating a correction propose nothing; after a third, optimization records the counts and proposes the pattern and a definition change with evidence',
      'Approving it materializes it into every enabled project; a definition variant is recorded on the runs it shapes',
    ],
    // The features each step checks, step by step
    checks: [
      ['automation.optimization', 'metrics.agent'],
      ['definition.approve', 'definition.variant'],
    ],
  },
  {
    id: 'guard-in-a-run',
    title: 'The guard holds a real run to valid entities',
    projects: ['todo-cli'],
    real: true,
    covers: ['guard.live-check', 'guard.stop-blocked', 'guard.inconsistent-issue', 'guard.land'],
    steps: [
      'A chat told to write an over-limit card with a broken reference is flagged at once',
      'The run cannot stop until it fixes the entity, then lands with its own message',
      'A run killed while its entity is invalid lands it with an issue raised over it',
    ],
    // The features each step checks, step by step
    checks: [
      ['guard.live-check'],
      ['guard.stop-blocked', 'guard.land'],
      ['guard.inconsistent-issue'],
    ],
  },
  {
    id: 'models-by-risk',
    title: 'Models chosen by risk',
    projects: ['bookshelf-api'],
    real: true,
    covers: ['run.models', 'settings.persist'],
    steps: ['In risk mode, a low-risk and a high-risk implementation start on the models the settings map them to'],
    // The features each step checks, step by step
    checks: [
      ['run.models', 'settings.persist'],
    ],
  },
  {
    id: 'scheduling',
    title: 'Scheduling across three projects',
    projects: ['todo-cli', 'bookshelf-api', 'handbook'],
    real: false,
    covers: [
      'orchestrator.feed-room', 'orchestrator.serial-automations', 'orchestrator.parallel-user-runs',
      'orchestrator.concurrent-total', 'trigger.schedule', 'trigger.on-demand', 'feed.rank', 'feed.size',
    ],
    steps: [
      'Due loops queue only while the feed has room, across all three projects',
      'One automation run per project at a time; user runs start at once; the total is never passed',
      'The feed ranks across projects and holds at most the feed size',
    ],
    // The features each step checks, step by step
    checks: [
      ['orchestrator.feed-room', 'trigger.schedule'],
      ['orchestrator.serial-automations', 'orchestrator.parallel-user-runs', 'orchestrator.concurrent-total', 'trigger.on-demand'],
      ['feed.rank', 'feed.size'],
    ],
  },
  {
    id: 'lifecycle',
    title: 'Disable, restart and reset',
    projects: ['todo-cli'],
    real: false,
    covers: [
      'project.disable', 'project.reset', 'project.harness-protected', 'orchestrator.restart-recovery',
    ],
    steps: [
      'Disabling stops the build; enabling resumes it',
      'A run lost at restart is queued again, and failed past the limit',
      'Reset leaves no entity, checkout or index row and builds afresh; the harness workspace refuses',
    ],
    // The features each step checks, step by step
    checks: [
      ['project.disable'],
      ['orchestrator.restart-recovery'],
      ['project.reset', 'project.harness-protected'],
    ],
  },
  {
    id: 'feed-and-patterns',
    title: 'Reactions become patterns and metrics',
    projects: ['handbook'],
    real: false,
    covers: [
      'feed.patterns', 'metrics.attention', 'metrics.understanding', 'metrics.implementation', 'metrics.per-automation',
      'feed.approve', 'feed.send-back',
    ],
    steps: [
      'Ten approvals of one type propose an automatic approval pattern in the feed; it counts once approved',
      'Every metric of the metrics page has a value after the reactions and runs',
    ],
    // The features each step checks, step by step
    checks: [
      ['feed.patterns', 'feed.approve', 'feed.send-back'],
      ['metrics.attention', 'metrics.understanding', 'metrics.implementation', 'metrics.per-automation'],
    ],
  },
  {
    id: 'access',
    title: 'API, MCP and app',
    projects: ['bookshelf-api'],
    real: false,
    covers: ['api.auth', 'api.http', 'api.mcp', 'voice.auth', 'app.pages', 'app.timeline', 'settings.persist', 'kb.search', 'kb.types'],
    steps: [
      'Wrong password refused; every HTTP route answers to its contract with a session and refuses without',
      'Every momentum MCP tool works against the project',
      'Voice sockets refuse an app that is not signed in',
      'Every app page loads and approves, sends back and chats against the backend',
      'The timeline lists the sign-ins, settings, reactions, chats and one event per run newest first, and shows the next one live beside the app',
    ],
    // The features each step checks, step by step
    checks: [
      ['api.auth', 'api.http', 'kb.search', 'kb.types', 'settings.persist'],
      ['api.mcp', 'kb.search', 'kb.types', 'settings.persist'],
      ['voice.auth'],
      ['app.pages'],
      ['app.timeline'],
    ],
  },
  {
    id: 'conversations',
    title: 'A day of chatting with the knowledge base',
    projects: ['bookshelf-api'],
    real: false,
    scripted: true,
    covers: [
      'automation.chat', 'run.messages', 'run.context', 'automation.summarization', 'feed.diff', 'feed.approve', 'app.pages', 'run.failure',
      'state.summarized-once', 'feed.once',
    ],
    steps: [
      'A question asked in the Chat tab is answered in the conversation, with the card parts added as context reaching the agent',
      'A follow-up continues the same chat; its transcript is summarized into a chat entity the chat list links to',
      'A chat asked to change an entity lands it unverified; the card shows a diff against the verified version until approved',
      'A chat the API fails for ends failed with the reason; the next message resumes it and gets an answer',
      'Approving or sending back one item from two devices at once acts once',
    ],
    // The features each step checks, step by step
    checks: [
      ['automation.chat', 'run.context', 'run.messages', 'app.pages'],
      ['run.messages', 'automation.summarization', 'state.summarized-once', 'app.pages'],
      ['automation.chat', 'feed.diff', 'feed.approve'],
      ['run.failure', 'run.messages'],
      ['feed.once', 'feed.approve'],
    ],
  },
  {
    id: 'feature-delivery',
    title: 'A feature from a goal to fixed, validated code',
    projects: ['bookshelf-api'],
    real: false,
    scripted: true,
    covers: [
      'automation.exploration', 'automation.preparation', 'automation.implementation', 'automation.validation', 'automation.summarization',
      'automation.chat', 'trigger.schedule', 'trigger.event', 'trigger.unverified-ignored', 'state.entity-ahead', 'guard.land',
      'feed.issue-options', 'orchestrator.serial-automations', 'metrics.implementation', 'run.checkout',
    ],
    steps: [
      'Exploration on its schedule proposes research and a feature that advances a goal',
      'An approved feature waits as entity_ahead while implementation is not approved; preparation writes a plan, summarized into a Harness/Plan',
      'Approving the plan starts implementation: code, tests and the updated card land in one commit; approving the result brings the plan in sync',
      'The finished implementation starts validation, which raises a defect; the user resolves it in their own words and the fix lands',
      'Automation runs of the project never overlapped and left no checkout behind',
    ],
    // The features each step checks, step by step
    checks: [
      ['automation.exploration', 'trigger.schedule'],
      ['state.entity-ahead', 'trigger.unverified-ignored', 'automation.preparation', 'automation.summarization', 'trigger.schedule', 'orchestrator.serial-automations'],
      ['trigger.event', 'automation.implementation', 'automation.summarization', 'guard.land', 'state.entity-ahead'],
      ['automation.validation', 'trigger.event', 'feed.issue-options', 'automation.chat', 'metrics.implementation'],
      ['orchestrator.serial-automations', 'run.checkout', 'trigger.schedule'],
    ],
  },
  {
    id: 'maintenance',
    title: 'Keeping a handbook consistent and lean',
    projects: ['handbook'],
    real: false,
    scripted: true,
    covers: [
      'automation.consistency-check', 'automation.retention', 'feed.issue-options', 'feed.wont-resolve', 'feed.contradictions',
      'metrics.understanding', 'metrics.implementation', 'guard.main-line-index', 'settings.persist', 'kb.validate', 'feed.retire',
    ],
    steps: [
      'The nightly consistency check files a contradiction and a naming clash as issues with options, counted as open; nothing else changes',
      'Picking the recommended option fixes the guide and its document in a chat; the issue retires and the contradiction count drops',
      "Won't resolve keeps the clash verified with the reason; it is no longer counted as open",
      'With the lifetimes the user set, retention proposes retiring spent entities; approving retires them but keeps one a new decision still relies on',
      'A user deleting an entity by hand on the main line is indexed at once: it leaves the index and the broken reference lowers consistency',
    ],
    // The features each step checks, step by step
    checks: [
      ['automation.consistency-check', 'feed.issue-options', 'feed.contradictions', 'metrics.understanding', 'metrics.implementation'],
      ['feed.issue-options', 'feed.contradictions', 'metrics.implementation'],
      ['feed.wont-resolve', 'metrics.implementation', 'metrics.understanding'],
      ['automation.retention', 'settings.persist', 'feed.retire'],
      ['guard.main-line-index', 'metrics.understanding', 'kb.validate'],
    ],
  },
  {
    id: 'graph-build-cycle',
    title: 'Building a knowledge graph through pauses, stops and failures',
    projects: ['todo-cli'],
    real: false,
    scripted: true,
    covers: [
      'project.enable', 'automation.graph-build', 'automation.summarization', 'orchestrator.feed-room', 'feed.size', 'feed.approve',
      'project.disable', 'app.timeline', 'metrics.per-automation', 'run.failure',
    ],
    steps: [
      'Enabling the project starts the build; its first run is told the room in the feed and its documents are summarized',
      'With the feed full the build waits; approving makes room and the next run continues from the reported progress',
      'Stopping the build in Settings ends the run in progress; resuming starts the next one',
      'A build whose runs keep failing stops after three failures in a row and says why, instead of retrying forever',
      'Resumed, the build completes: coverage 1, an estimate from the runs, and nothing more queued',
    ],
    // The features each step checks, step by step
    checks: [
      ['project.enable', 'automation.graph-build', 'automation.summarization', 'orchestrator.feed-room', 'feed.size'],
      ['orchestrator.feed-room', 'feed.size', 'feed.approve', 'automation.graph-build'],
      ['project.disable', 'app.timeline', 'automation.graph-build'],
      ['run.failure', 'app.timeline'],
      ['automation.graph-build', 'metrics.per-automation', 'app.timeline', 'feed.size'],
    ],
  },
  {
    id: 'interruptions',
    title: 'Runs interrupted by restarts, the guard and the user',
    projects: ['todo-cli'],
    real: false,
    scripted: true,
    covers: [
      'orchestrator.restart-recovery', 'run.kill', 'run.messages', 'guard.live-check', 'guard.stop-blocked', 'guard.inconsistent-issue',
      'guard.land', 'kb.validate', 'automation.consistency-check',
    ],
    steps: [
      'The harness restarting mid-run queues the automation run again; it resumes its session and lands its work once',
      'A chat lost at restart fails, yet what it wrote lands; the next message resumes it',
      'A run writing an invalid entity is told at once, cannot stop until it fixes it, then lands valid under its own message',
      'A run that never fixes its entity lands it after two tries with an issue raised over it',
      'Stopping a chat from its conversation lands what it wrote so far, and the timeline says the user stopped it',
    ],
    // The features each step checks, step by step
    checks: [
      ['orchestrator.restart-recovery', 'automation.consistency-check', 'guard.land'],
      ['orchestrator.restart-recovery', 'run.messages', 'guard.land'],
      ['guard.live-check', 'guard.stop-blocked', 'guard.land', 'kb.validate'],
      ['guard.inconsistent-issue', 'guard.stop-blocked', 'kb.validate'],
      ['run.kill', 'guard.land'],
    ],
  },
  {
    id: 'harness-tuning',
    title: 'Tuning the harness: models, definitions and triggers',
    projects: ['bookshelf-api'],
    real: false,
    scripted: true,
    covers: [
      'run.models', 'settings.persist', 'automation.optimization', 'metrics.agent', 'definition.approve', 'definition.materialize',
      'definition.variant', 'definition.review', 'trigger.on-demand', 'trigger.schedule', 'guard.harness-scope',
    ],
    steps: [
      'Per automation, each run starts on the model the settings give its automation',
      "By risk, the estimator applies the user's rules: a typo fix starts on haiku, a schema change on opus",
      'Chats repeating one correction lead optimization in the harness to count it and propose a definition change',
      'Approving the proposal materializes it into the project and its variant is recorded on the runs it shapes; an agent file changed without approval is never materialized',
      'Triggers the user edits by hand take effect: without on_demand it refuses starts, and a new schedule is followed',
      "An exploration in the harness lands its research, while the code it changed is put back and raised as an issue",
    ],
    // The features each step checks, step by step
    checks: [
      ['run.models', 'settings.persist'],
      ['run.models', 'settings.persist'],
      ['automation.optimization', 'metrics.agent', 'definition.review'],
      ['definition.approve', 'definition.materialize', 'definition.variant', 'definition.review'],
      ['trigger.on-demand', 'trigger.schedule'],
      ['guard.harness-scope'],
    ],
  },
  {
    id: 'devices',
    title: 'A phone and a laptop, signed in, offline and back',
    projects: ['handbook'],
    real: false,
    scripted: true,
    covers: ['api.auth', 'voice.auth', 'api.mcp', 'feed.approve', 'feed.send-back', 'app.pages', 'app.timeline', 'app.offline', 'feed.once', 'settings.persist'],
    steps: [
      'Two devices sign in side by side; a wrong password is refused and recorded on the timeline',
      'Signing out on one device ends only its session: its API, MCP and voice requests are refused',
      'Swipes made while the back-end is unreachable wait on the phone and land once it is back; one also made on the laptop counts once',
      'A project logo is served with the project and recorded; removing it falls back to the drawn one; a file that is not an image is refused',
      'The timeline filters by project and actor and pages back without gaps or repeats',
    ],
    // The features each step checks, step by step
    checks: [
      ['api.auth', 'app.timeline'],
      ['api.auth', 'voice.auth', 'api.mcp', 'app.pages'],
      ['app.offline', 'feed.once', 'feed.approve', 'feed.send-back', 'app.pages'],
      ['settings.persist', 'app.pages', 'app.timeline'],
      ['app.timeline', 'app.pages'],
    ],
  },
  {
    id: 'project-churn',
    title: 'Projects cloned, switched off and removed while the harness runs',
    projects: ['handbook'],
    real: false,
    scripted: true,
    covers: ['project.discover', 'project.churn', 'project.enable', 'project.disable', 'trigger.defaults', 'orchestrator.serial-automations', 'feed.rank', 'run.checkout'],
    steps: [
      'A repository cloned under the root while the harness runs is listed, disabled, without a restart',
      'Enabled, a project whose main line is master gets its triggers there and its runs land on master',
      'Disabling a project keeps its queued runs from starting and its items out of the feed; enabling it again starts them',
      'A project folder removed from the root leaves the list and the feed, and the harness goes on',
    ],
    // The features each step checks, step by step
    checks: [
      ['project.discover', 'project.churn'],
      ['project.enable', 'project.churn', 'trigger.defaults', 'run.checkout'],
      ['project.disable', 'project.enable', 'orchestrator.serial-automations', 'feed.rank'],
      ['project.churn', 'feed.rank'],
    ],
  },
  {
    id: 'documents',
    title: 'Documents edited by hand and by runs, kept summarized',
    projects: ['handbook'],
    real: false,
    scripted: true,
    covers: [
      'guard.main-line-index', 'state.artifact-ahead', 'state.updating', 'state.summarized-once', 'automation.summarization', 'settings.persist',
      'orchestrator.serial-automations', 'run.failure',
    ],
    steps: [
      'One commit editing two documents starts one summarization run that rewrites both cards',
      'A summarization that finds a card still right leaves it synced, not stuck updating',
      'A failed summarization leaves its entities behind their documents until the next edit summarizes them',
      'Two quick edits of one document: the second is summarized after the first, and the card ends on the latest',
      'A run editing an excluded document and a summarized one hands only the summarized one to summarization',
    ],
    // The features each step checks, step by step
    checks: [
      ['guard.main-line-index', 'state.artifact-ahead', 'state.updating', 'automation.summarization'],
      ['state.summarized-once', 'automation.summarization'],
      ['run.failure', 'state.summarized-once', 'state.artifact-ahead', 'automation.summarization'],
      ['orchestrator.serial-automations', 'automation.summarization'],
      ['settings.persist', 'automation.summarization'],
    ],
  },
  {
    id: 'voice',
    title: 'Talking to the harness on every screen',
    projects: ['bookshelf-api'],
    real: false,
    scripted: true,
    covers: ['voice.routing', 'voice.stream', 'automation.interview', 'automation.chat', 'run.context', 'automation.summarization'],
    steps: [
      'Said on the explorer, a phrase becomes the search; on an entity, a question asks about it and a command changes it',
      'Said on a new chat, a question starts a chat and what is said next goes on in it; "stop interview" there is ignored',
      'An interview started by voice asks one question at a time and writes the answers into one document; a skip writes nothing and a question back is answered',
      '"Stop interview" ends it and its document is summarized into an entity once',
      'After a restart nothing said before is acted on again',
    ],
    // The features each step checks, step by step
    checks: [
      ['voice.routing', 'automation.chat', 'run.context'],
      ['voice.routing', 'automation.chat'],
      ['automation.interview', 'voice.routing'],
      ['automation.interview', 'automation.summarization'],
      ['voice.stream'],
    ],
  },
  {
    id: 'todo-cli-release',
    title: 'todo-cli from a weekend script to its 1.1 release',
    projects: ['todo-cli'],
    real: false,
    scripted: true,
    covers: [
      'state.new-files', 'state.artifact-ahead', 'state.summarized-once', 'automation.summarization', 'automation.chat', 'automation.implementation',
      'feed.send-back', 'feed.diff', 'state.entity-ahead', 'guard.main-line-index',
    ],
    steps: [
      'A module the user commits by hand is summarized into a new card, since no entity covered it',
      'A feature request from the chat becomes a user story; implemented, its result is sent back for a test and approved with it',
      'A version bump is summarized into the repository card; a README tweak that changes nothing the card says leaves the feed as it was',
      'The release: a chat writes the changelog and a release note that references what shipped',
      'A small fix the user commits re-summarizes the one card over that file',
    ],
    // The features each step checks, step by step
    checks: [
      ['state.new-files', 'state.artifact-ahead', 'automation.summarization', 'guard.main-line-index'],
      ['automation.chat', 'state.entity-ahead', 'automation.implementation', 'feed.send-back', 'state.summarized-once'],
      ['state.artifact-ahead', 'automation.summarization', 'feed.diff', 'state.summarized-once'],
      ['automation.chat', 'state.summarized-once'],
      ['state.artifact-ahead', 'automation.summarization', 'guard.main-line-index'],
    ],
  },
  {
    id: 'bug-lifecycle',
    title: 'A bookshelf bug from the report to the fix, and a regression',
    projects: ['bookshelf-api'],
    real: false,
    scripted: true,
    covers: [
      'automation.chat', 'automation.implementation', 'automation.validation', 'trigger.event', 'trigger.schedule', 'metrics.implementation',
      'feed.retire', 'feed.issue-options', 'orchestrator.parallel-user-runs', 'trigger.on-demand',
    ],
    steps: [
      'A bug the user files through the chat is counted open',
      'Approved, the bug is fixed and validated; it counts as fixed once the fix is approved',
      'A duplicate report is sent back and retired',
      'The nightly validation catches a regression the user committed; picking the fix option repairs it',
      'A hotfix started on demand runs at once beside the automation run in progress',
    ],
    // The features each step checks, step by step
    checks: [
      ['automation.chat', 'metrics.implementation'],
      ['automation.implementation', 'automation.validation', 'trigger.event', 'metrics.implementation'],
      ['feed.retire', 'automation.chat', 'metrics.implementation'],
      ['trigger.schedule', 'automation.validation', 'feed.issue-options', 'metrics.implementation'],
      ['orchestrator.parallel-user-runs', 'trigger.on-demand'],
    ],
  },
  {
    id: 'refactoring',
    title: 'Refactoring bookshelf: files renamed, split, deleted and reverted',
    projects: ['bookshelf-api'],
    real: false,
    scripted: true,
    covers: ['state.moved-files', 'state.new-files', 'state.artifact-ahead', 'automation.summarization', 'feed.retire', 'metrics.understanding'],
    steps: [
      'A renamed module: the card over it follows the new path',
      'Routes split out of the server into a new file: one summarization run covers both files under the API',
      'A deleted design document: its entity is retired once nothing references it',
      'The rename reverted: the card follows the file back and the graph stays consistent',
    ],
    // The features each step checks, step by step
    checks: [
      ['state.moved-files', 'state.artifact-ahead', 'automation.summarization'],
      ['state.new-files', 'state.artifact-ahead', 'automation.summarization'],
      ['feed.retire', 'state.moved-files', 'state.artifact-ahead', 'automation.summarization'],
      ['state.moved-files', 'state.artifact-ahead', 'automation.summarization', 'metrics.understanding'],
    ],
  },
  {
    id: 'sprint',
    title: 'A two-week sprint on todo-cli',
    projects: ['todo-cli'],
    real: false,
    scripted: true,
    covers: [
      'feed.rank', 'feed.send-back', 'feed.retire', 'orchestrator.serial-automations', 'orchestrator.parallel-user-runs', 'run.retry', 'run.failure',
      'metrics.attention', 'metrics.per-automation', 'app.timeline',
    ],
    steps: [
      'Sprint planning in the chat writes the sprint and its tasks, ranked by impact',
      'A task too big is sent back, split in two and retired',
      'Approved tasks are implemented one at a time in order, while the user chats',
      'A failed implementation leaves its task to do; started again on demand, it lands',
      'The sprint review: metrics and the timeline show the sprint',
    ],
    // The features each step checks, step by step
    checks: [
      ['feed.rank'],
      ['feed.send-back', 'feed.retire'],
      ['orchestrator.serial-automations', 'orchestrator.parallel-user-runs'],
      ['run.retry', 'run.failure'],
      ['metrics.attention', 'metrics.per-automation', 'app.timeline', 'run.failure'],
    ],
  },
  {
    id: 'handbook-yearly-update',
    title: "The handbook's yearly update",
    projects: ['handbook'],
    real: false,
    scripted: true,
    covers: ['state.new-files', 'state.moved-files', 'automation.summarization', 'settings.persist', 'feed.retire', 'feed.approve'],
    steps: [
      'A new policy document is summarized into a new policy',
      'One commit across three documents is summarized in one run',
      'Policies moved into a folder: the cards follow their documents, their words unchanged',
      'A policy archived: its entity is proposed for retirement and kept while others reference it',
    ],
    // The features each step checks, step by step
    checks: [
      ['state.new-files', 'automation.summarization', 'feed.approve'],
      ['automation.summarization'],
      ['state.moved-files'],
      ['state.moved-files', 'settings.persist', 'feed.retire'],
    ],
  },
  {
    id: 'morning-triage',
    title: 'A morning with a full feed from two projects',
    projects: ['handbook', 'todo-cli'],
    real: false,
    scripted: true,
    covers: ['feed.size', 'feed.rank', 'orchestrator.feed-room', 'feed.stale', 'metrics.attention', 'automation.graph-build', 'feed.issue-options', 'feed.wont-resolve'],
    steps: [
      'Overnight, automations in both projects fill the feed to its size and the build waits',
      'A quick triage: resolve, dismiss and approve, each timed',
      'A card that changed after the phone showed it is not approved unseen; its new version is',
      'With room made, the paused build goes on until complete',
    ],
    // The features each step checks, step by step
    checks: [
      ['feed.size', 'feed.rank', 'orchestrator.feed-room'],
      ['feed.issue-options', 'feed.wont-resolve', 'metrics.attention'],
      ['feed.stale'],
      ['automation.graph-build', 'orchestrator.feed-room', 'feed.size'],
    ],
  },
  {
    id: 'review-rounds',
    title: 'A card through three review rounds',
    projects: ['todo-cli'],
    real: false,
    scripted: true,
    covers: ['feed.diff', 'feed.send-back', 'feed.approve', 'metrics.attention', 'app.timeline'],
    steps: [
      'A chat changes a card; it waits in the feed as a diff against the approved version',
      'Three rounds of send back: each diff is against the approved version, not the round before',
      'Approved: the diff goes, three send backs and one approval are counted, each comment is on the timeline',
      'The next change diffs against the card approved last',
    ],
    // The features each step checks, step by step
    checks: [
      ['feed.diff'],
      ['feed.diff', 'feed.send-back'],
      ['feed.approve', 'metrics.attention', 'app.timeline', 'feed.send-back'],
      ['feed.diff'],
    ],
  },
  {
    id: 'handbook-answers',
    title: 'Finding answers in the handbook',
    projects: ['handbook'],
    real: false,
    scripted: true,
    covers: ['kb.search', 'app.pages', 'run.context', 'run.messages', 'automation.chat', 'feed.send-back', 'api.http'],
    steps: [
      'Searching the explorer finds the policy by its words and by its meaning; its card and document open',
      'A question with the policy as context is answered, and the follow-up keeps it',
      'A question the handbook does not answer becomes a FAQ, which the user answers through a send back',
      'Later the answer is found by search',
    ],
    // The features each step checks, step by step
    checks: [
      ['kb.search', 'app.pages', 'api.http'],
      ['run.context', 'run.messages', 'automation.chat', 'app.pages'],
      ['automation.chat', 'feed.send-back'],
      ['kb.search', 'app.pages'],
    ],
  },
  {
    id: 'links-and-answers',
    title: 'Entities linked everywhere, and the graph answering questions',
    projects: ['handbook'],
    real: false,
    scripted: true,
    covers: ['app.entity-links', 'app.entity-folds', 'kb.ask', 'settings.graph-config', 'app.pages', 'automation.chat'],
    steps: [
      "An entity's references and artifacts are folded; opened, the references group by type and open on a press",
      'A link in a card and a link or path in a chat answer read as entities and open them',
      'A question typed in the search is answered above the results, linking what it drew from; keywords are answered on Enter',
      "Settings lead to the automations, the entity types and each project's triggers and patterns in the knowledge graph",
    ],
    // The features each step checks, step by step
    checks: [
      ['app.entity-folds', 'app.entity-links'],
      ['app.entity-links', 'automation.chat'],
      ['kb.ask', 'app.entity-links', 'app.pages'],
      ['settings.graph-config', 'app.pages'],
    ],
  },
  {
    id: 'busy-chat-day',
    title: 'A busy day of chats within the total of runs',
    projects: ['bookshelf-api'],
    real: false,
    scripted: true,
    covers: ['run.queue', 'orchestrator.concurrent-total', 'orchestrator.parallel-user-runs', 'run.messages', 'feed.once', 'run.kill'],
    steps: [
      'Five questions at once: three run, two wait, oldest first',
      'A follow-up to a waiting chat joins its first question and is answered with it',
      'A send back of the entity a chat is working on joins that chat',
      'A waiting chat stopped by the user never starts',
    ],
    // The features each step checks, step by step
    checks: [
      ['run.queue', 'orchestrator.concurrent-total', 'orchestrator.parallel-user-runs'],
      ['run.queue', 'run.messages'],
      ['feed.once', 'run.messages'],
      ['run.kill', 'run.queue', 'orchestrator.concurrent-total'],
    ],
  },
  {
    id: 'working-alongside',
    title: 'The user and the harness in one repository at once',
    projects: ['todo-cli'],
    real: false,
    scripted: true,
    covers: ['guard.conflict', 'guard.user-checkout', 'guard.land', 'run.checkout', 'automation.chat'],
    steps: [
      "A run and the user change the same line of a file: the run's version lands on top of the user's commit, with a Harness/Conflict in the same commit over the entity concerned, waiting in the feed",
      "The user's uncommitted edit and untracked file stay as a run lands changes to other files; the checkout follows the main line",
      "The user's uncommitted edit to the very file a run lands is kept in their checkout, while the main line takes the run's version",
    ],
    // The features each step checks, step by step
    checks: [
      ['guard.conflict', 'guard.land', 'run.checkout', 'automation.chat'],
      ['guard.user-checkout', 'guard.land'],
      ['guard.user-checkout', 'guard.land'],
    ],
  },
  {
    id: 'kb-tools',
    title: 'A run working through the knowledge-base tools',
    projects: ['bookshelf-api'],
    real: false,
    scripted: true,
    covers: ['kb.mcp', 'kb.search', 'kb.types', 'kb.validate', 'guard.live-check', 'guard.land'],
    steps: [
      'A chat lists the entity types, searches by meaning and reaches the neighbours along references, reads a card and lists its references both ways, all through the momentum-kb tools',
      'Written through the tool, an over-limit card with a broken reference comes back with the issues the guard raises; written right, the entity lands and waits in the feed',
    ],
    // The features each step checks, step by step
    checks: [
      ['kb.mcp', 'kb.search', 'kb.types'],
      ['kb.mcp', 'kb.validate', 'guard.live-check', 'guard.land'],
    ],
  },
  {
    id: 'card-rules',
    title: 'Card rules, risk rules and settings that stay',
    projects: ['bookshelf-api'],
    real: false,
    scripted: true,
    covers: ['settings.persist', 'settings.graph-config', 'run.models', 'guard.live-check', 'kb.validate', 'kb.mcp'],
    steps: [
      "The card limit and presentation rules set in Settings reach the next run's instructions; a card over the new limit is refused by the write tool and flagged by the guard",
      'Risk rules the user edits in the harness knowledge graph are what the estimator is asked with: the next implementation starts on the model its answer leads to',
      'After a restart every setting stands: feed size, card limit and rules, exclusions, lifetimes, total runs and models',
    ],
    // The features each step checks, step by step
    checks: [
      ['settings.persist', 'guard.live-check', 'kb.validate', 'kb.mcp'],
      ['settings.graph-config', 'run.models'],
      ['settings.persist'],
    ],
  },
  {
    id: 'voice-stream',
    title: 'Following the command stream through holes, replays and drops',
    projects: ['bookshelf-api'],
    real: false,
    scripted: true,
    covers: ['voice.stream', 'voice.routing', 'automation.chat', 'run.messages'],
    steps: [
      'Three things said on a new chat become its question and two messages, in that order',
      'An item lost on the way leaves a hole in the sequence: the harness fetches the state afresh and acts on the item once',
      'An item delivered twice, a dropped connection and a restart act on nothing again',
    ],
    // The features each step checks, step by step
    checks: [
      ['voice.routing', 'automation.chat', 'run.messages'],
      ['voice.stream', 'run.messages'],
      ['voice.stream', 'run.messages'],
    ],
  },
  {
    id: 'typescript-service',
    title: 'A TypeScript service with dependencies and a history',
    projects: ['notes-api'],
    real: false,
    scripted: true,
    covers: [
      'project.dependencies', 'project.history', 'project.enable', 'automation.graph-build', 'automation.summarization', 'automation.implementation',
      'automation.validation', 'guard.land', 'run.checkout', 'trigger.event', 'trigger.schedule',
    ],
    steps: [
      'Enabled, the build maps the repository over several runs until every source file is an artifact of an entity; the history stays as it was, each run one commit on top',
      "An approved user story is implemented: the run installs the dependencies in its checkout, type-checks and tests there; code, test and card land in one commit, and the user's checkout passes",
      'Validation installs and checks the landed work and raises nothing; a commit of the user that breaks the type check is raised by the nightly validation with what the compiler said',
    ],
    // The features each step checks, step by step
    checks: [
      ['project.enable', 'project.history', 'automation.graph-build', 'automation.summarization'],
      ['project.dependencies', 'automation.implementation', 'guard.land', 'run.checkout', 'project.history'],
      ['project.dependencies', 'automation.validation', 'trigger.event', 'trigger.schedule'],
    ],
  },
  {
    id: 'api-contract',
    title: 'Every route and every tool, to their contract',
    projects: ['handbook', 'todo-cli'],
    real: false,
    scripted: true,
    covers: [
      'api.http', 'api.mcp', 'api.auth', 'feed.approve', 'feed.send-back', 'feed.issue-options', 'feed.wont-resolve', 'project.reset',
      'project.harness-protected', 'project.disable', 'automation.graph-build',
    ],
    steps: [
      'Every route of the OpenAPI document the back-end serves is called, and each answer, refusals included, is what its schema allows',
      'Through the momentum MCP server, a card is approved, one sent back, an issue resolved with an option and another closed as won\'t resolve',
      'Through MCP, the graph build is stopped and started again, and a project is reset while the harness refuses to be',
    ],
    // The features each step checks, step by step
    checks: [
      ['api.http', 'api.auth', 'feed.approve', 'feed.send-back', 'feed.issue-options', 'feed.wont-resolve', 'project.reset'],
      ['api.mcp', 'feed.approve', 'feed.send-back', 'feed.issue-options', 'feed.wont-resolve'],
      ['api.mcp', 'project.disable', 'automation.graph-build', 'project.reset', 'project.harness-protected'],
    ],
  },
  {
    id: 'feed-in-the-app',
    title: 'A feed worked through on the phone, card by card',
    projects: ['handbook', 'todo-cli'],
    real: false,
    scripted: true,
    covers: ['feed.swipes', 'feed.rank', 'feed.approve', 'feed.send-back', 'feed.issue-options', 'feed.wont-resolve', 'app.pages', 'automation.chat'],
    steps: [
      'The feed orders the cards of both projects by their summed impact; equal ranks keep the order they came in',
      'Swiped right, the top card is approved in one commit',
      "An issue's recommended option is picked on the card and swiped right; a chat resolves it with that option",
      "Swiped left, an issue is resolved in the user's own words, and another closed as won't resolve with the reason",
      'Swiped left with a comment, a card is sent back to a chat on it; nothing went through the API instead of the app',
    ],
    // The features each step checks, step by step
    checks: [
      ['feed.rank', 'app.pages'],
      ['feed.swipes', 'feed.approve'],
      ['feed.swipes', 'feed.issue-options', 'automation.chat'],
      ['feed.swipes', 'feed.issue-options', 'feed.wont-resolve'],
      ['feed.swipes', 'feed.send-back'],
    ],
  },
  {
    id: 'run-accounting',
    title: "What each run took of the account and of the machine",
    projects: ['bookshelf-api'],
    real: false,
    scripted: true,
    covers: ['run.usage-share', 'run.process-limits', 'metrics.per-automation', 'orchestrator.parallel-user-runs', 'automation.chat'],
    steps: [
      'A run alone takes the whole rise of the account limits between its readings, shown on the run and in the metrics',
      'Two runs at once split a rise evenly; a run started after it gets none of it, only its own',
      'Each run is held to the memory and CPU limits set for runs, as its own job reports from inside; a command that would pass the memory limit does not get it',
    ],
    // The features each step checks, step by step
    checks: [
      ['run.usage-share', 'metrics.per-automation', 'automation.chat'],
      ['run.usage-share', 'orchestrator.parallel-user-runs'],
      ['run.process-limits'],
    ],
  },
  {
    id: 'linear-work',
    title: 'One straight line, enforced',
    projects: ['todo-cli'],
    real: false,
    scripted: true,
    covers: ['project.linear', 'project.enable', 'project.disable', 'guard.land', 'feed.approve', 'app.timeline'],
    steps: [
      'A project with a second branch cannot be enabled; the refusal says why, and without the branch it enables',
      'A branch or a detached HEAD appearing in an enabled project switches it off at once, says why, and nothing of it runs',
      'A merge commit landing on the line switches it off the same way',
      'Runs and approvals keep one straight line: one branch, no merge commits',
    ],
    // The features each step checks, step by step
    checks: [
      ['project.enable', 'project.linear'],
      ['project.linear', 'project.disable', 'app.timeline'],
      ['project.linear', 'app.timeline'],
      ['guard.land', 'feed.approve', 'project.linear'],
    ],
  },
];
