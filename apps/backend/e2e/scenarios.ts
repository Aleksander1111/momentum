import type { Feature } from './features.ts';

/**
 * End-to-end scenarios over the example projects in examples/. Each runs in isolation: its own workspaces root, its
 * own database, a fresh copy of its example project and of the harness definitions. A `real` scenario starts real
 * Claude Code runs and is skipped once the account's 5-hour or weekly usage passes the cap.
 */
export interface Scenario {
  id: string;
  title: string;
  projects: ('todo-cli' | 'bookshelf-api' | 'handbook')[];
  real: boolean;
  covers: Feature[];
  steps: string[];
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
  },
  {
    id: 'exploration-idle',
    title: 'Exploration stays idle when every goal is met',
    projects: ['todo-cli'],
    real: true,
    covers: ['automation.exploration'],
    steps: ['With every goal marked met, a scheduled exploration run writes nothing'],
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
  },
  {
    id: 'optimization',
    title: 'Optimization proposes from recurring issues',
    projects: ['bookshelf-api'],
    real: true,
    covers: ['automation.optimization', 'metrics.agent', 'definition.approve', 'definition.variant'],
    steps: [
      'After chats in a project repeat the same correction, optimization in the harness workspace records the counts and proposes a definition change with evidence',
      'Approving it materializes it into every enabled project; a definition variant is recorded on the runs it shapes',
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
  },
  {
    id: 'models-by-risk',
    title: 'Models chosen by risk',
    projects: ['bookshelf-api'],
    real: true,
    covers: ['run.models', 'settings.persist'],
    steps: ['In risk mode, a low-risk and a high-risk implementation start on the models the settings map them to'],
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
  },
  {
    id: 'lifecycle',
    title: 'Disable, restart and reset',
    projects: ['todo-cli'],
    real: false,
    covers: [
      'project.disable', 'project.reset', 'project.harness-protected', 'orchestrator.restart-recovery', 'legacy.run-branches',
      'guard.conflict',
    ],
    steps: [
      'Disabling stops the build; enabling resumes it',
      'A run lost at restart is queued again, and failed past the limit',
      'Leftover momentum/ branches land oldest first and go',
      'A run whose entity changed on the main line meanwhile lands on the run side and raises the conflict',
      'Reset leaves no entity, checkout or index row and builds afresh; the harness workspace refuses',
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
      'Ten approvals of one type become an automatic approval pattern',
      'Every metric of the metrics page has a value after the reactions and runs',
    ],
  },
  {
    id: 'access',
    title: 'API, MCP and app',
    projects: ['bookshelf-api'],
    real: false,
    covers: ['api.auth', 'api.http', 'api.mcp', 'voice.auth', 'app.pages', 'settings.persist', 'kb.search', 'kb.types'],
    steps: [
      'Wrong password refused; every HTTP route answers to its contract with a session and refuses without',
      'Every momentum MCP tool works against the project',
      'Voice sockets refuse an app that is not signed in',
      'Every app page loads and approves, sends back and chats against the backend',
    ],
  },
];
