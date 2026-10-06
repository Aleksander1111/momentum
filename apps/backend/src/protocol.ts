/**
 * What the harness says to a run, in the words a reader recognizes it by. The hooks and the runner build their messages
 * from these, and whatever reads a run's conversation (the bookkeeping filter here, the end-to-end stand-in for the
 * model) matches on them: a rewording changes both sides at once.
 */
export const SAY = {
  /** The Stop hook handing the run's artifacts to the summarization sub-agent */
  summarize: 'have the momentum-summarization sub-agent summarize',
  /** The Stop hook asking for the commit message the run's changes land with */
  commitMessage: 'write the commit message your changes land on the main line with',
  /** The Stop hook sending the run back over knowledge-base changes the guard refuses */
  guardRefusal: 'the consistency guard cannot accept these knowledge-base changes',
  /** The PostToolUse hook flagging a write the guard will refuse */
  guardFlag: 'consistency guard will not accept',
  /** A run queued again after a restart, resuming its session */
  resume: 'The harness restarted while you were working',
  /** The risk estimator's instructions */
  riskEstimate: 'estimate the risk of an implementation',
} as const;

/** The commit message request: where the run writes it */
export const messageRequest = (file: string) =>
  `Before you finish, ${SAY.commitMessage} to ${file}, replacing what it holds: ` +
  'a subject line of at most 72 characters in the imperative mood saying what was done, then, when the subject alone does ' +
  'not say it, a blank line and a short body. Describe the work itself: no run id, no automation name, no prefix.';
export const MESSAGE_FILE = /write the commit message .*? to (.+?), replacing what it holds/s;

/** The run's context lines: where it works, and which run it is */
export const workspaceLine = (ws: { name: string; path: string; main: string }, checkout: string) =>
  `- Workspace: ${ws.name} (${ws.path}); this checkout: ${checkout}; main line: ${ws.main}`;
export const CHECKOUT = /this checkout: (.+?); main line:/;
export const runLine = (r: { id: string; automation: string; trigger: string; targetPath: string | null }) =>
  `- Run: ${r.id}, automation ${r.automation}, started by ${r.trigger}${r.targetPath ? `, target entity ${r.targetPath}` : ''}`;
export const RUN_LINE = /^- Run: (\w+), automation ([\w-]+), started by (\w+)(?:, target entity (\S+))?$/m;
