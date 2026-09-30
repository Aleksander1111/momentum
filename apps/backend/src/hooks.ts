import type { HookCallbackMatcher, HookEvent, HookInput, SyncHookJSONOutput } from '@anthropic-ai/claude-agent-sdk';
import { fileOf, type ValidationIssue } from '@momentum/entity';
import { isAbsolute, join } from 'node:path';
import type { Guard, RunRef } from './guard.ts';

/** How often the Stop hook sends a run back to fix its changes before the guard raises an issue instead */
const MAX_STOP_BLOCKS = 2;

const list = (issues: ValidationIssue[]) => issues.map((i) => `- ${i.path}: ${i.message}`).join('\n');

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
 */
export function guardHooks(guard: Guard, run: RunRef): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  let blocks = 0;
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
                additionalContext: `The consistency guard will not accept this change yet:\n${list(issues)}`,
              },
            };
          },
        ],
      },
    ],
    Stop: [
      {
        hooks: [
          async (input): Promise<SyncHookJSONOutput> => {
            if (input.hook_event_name !== 'Stop' || blocks >= MAX_STOP_BLOCKS) return {};
            const { issues } = await guard.check(run);
            if (issues.length === 0) return {};
            blocks++;
            return {
              decision: 'block',
              reason: `Before you finish: the consistency guard cannot accept these knowledge-base changes on this branch. Fix them, or remove the change:\n${list(issues)}`,
            };
          },
        ],
      },
    ],
  };
}
