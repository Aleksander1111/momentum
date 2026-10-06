import type { HookCallbackMatcher, HookEvent, HookInput, SyncHookJSONOutput } from '@anthropic-ai/claude-agent-sdk';
import { fileOf, type ValidationIssue } from '@momentum/entity';
import { head, messageFile, workingTree } from '@momentum/runs';
import { isAbsolute, join } from 'node:path';
import type { Guard, RunRef } from './guard.ts';
import { messageRequest, SAY } from './protocol.ts';

/** How often the Stop hook sends a run back to fix its changes before the guard raises an issue instead */
const MAX_STOP_BLOCKS = 2;
/** The sub-agent every run hands its artifacts to */
export const SUMMARIZATION_AGENT = 'momentum-summarization';

const list = (issues: ValidationIssue[]) => issues.map((i) => `- ${i.path}: ${i.message}`).join('\n');

/**
 * What the Stop hook sent the run on for: the harness's bookkeeping (summarizing its artifacts, describing its changes),
 * whose replies are not for the user, or a fix of what the guard refused, which is
 */
export const bookkeeping = (feedback: string) => feedback.includes(SAY.summarize) || feedback.includes(SAY.commitMessage);

function writtenFile(run: RunRef, input: HookInput): string | null {
  if (input.hook_event_name !== 'PostToolUse') return null;
  const args = (input.tool_input ?? {}) as { file_path?: string; notebook_path?: string; path?: string };
  if (input.tool_name === 'mcp__momentum-kb__write') return args.path ? join(run.checkout, fileOf(args.path)) : null;
  const file = args.file_path ?? args.notebook_path;
  if (!file) return null;
  return isAbsolute(file) ? file : join(run.checkout, file);
}

/**
 * Claude Code hooks that put the consistency guard inside the run: every write to the knowledge base is checked as it
 * happens, and the run cannot end with changes the guard would not accept until it has had a chance to fix them.
 * Before that, the Stop hook hands the run's artifacts to summarization: `summarize` returns what to summarize, or null.
 * Last, it asks the run for the commit message its changes land with, again whenever they change after it wrote one,
 * unless `describe` says this stop needs none (an interview's answers land with what they changed until it is done).
 */
export function guardHooks(
  guard: Guard,
  run: RunRef,
  summarize: () => Promise<string | null> = async () => null,
  describe: () => boolean = () => true,
): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  let blocks = 0;
  let described: string | null = null; // the working tree the run's commit message describes
  return {
    PostToolUse: [
      {
        matcher: 'Write|Edit|MultiEdit|NotebookEdit|mcp__momentum-kb__write',
        hooks: [
          async (input): Promise<SyncHookJSONOutput> => {
            const file = writtenFile(run, input);
            if (!file) return {};
            const issues = await guard.checkFile(run, file);
            if (issues.length === 0) return {};
            return {
              hookSpecificOutput: {
                hookEventName: 'PostToolUse',
                additionalContext: `The ${SAY.guardFlag} this change yet:\n${list(issues)}`,
              },
            };
          },
        ],
      },
    ],
    // The summarization step finished: what it was handed is its to have summarized, or left as it stood
    SubagentStop: [
      {
        hooks: [
          async (input): Promise<SyncHookJSONOutput> => {
            if (input.hook_event_name === 'SubagentStop' && input.agent_type === SUMMARIZATION_AGENT) guard.summarizationRan(run.id);
            return {};
          },
        ],
      },
    ],
    Stop: [
      {
        hooks: [
          async (input): Promise<SyncHookJSONOutput> => {
            if (input.hook_event_name !== 'Stop') return {};
            // Once per stop the run reaches by itself, so summarizing never loops
            if (!input.stop_hook_active) {
              const request = await summarize();
              if (request) return { decision: 'block', reason: request };
            }
            if (blocks < MAX_STOP_BLOCKS) {
              const { issues } = await guard.check(run);
              if (issues.length > 0) {
                blocks++;
                return {
                  decision: 'block',
                  reason: `Before you finish: ${SAY.guardRefusal}. Fix them, or remove the change:\n${list(issues)}`,
                };
              }
            }
            if (!describe()) return {};
            const tree = await workingTree(run.checkout);
            if (tree === described || tree === (await head(run.checkout, 'HEAD^{tree}'))) return {};
            described = tree;
            return { decision: 'block', reason: messageRequest(await messageFile(run.checkout)) };
          },
        ],
      },
    ],
  };
}
