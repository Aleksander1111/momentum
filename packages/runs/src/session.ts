import {
  query,
  type AgentDefinition,
  type HookCallbackMatcher,
  type HookEvent,
  type McpServerConfig,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { spawnLimited, type ResourceLimits } from './process.ts';

export interface Usage {
  /** Percentage of the rolling 5-hour limit used, 0–100 */
  fiveHour: number | null;
  /** Percentage of the rolling weekly limit used, 0–100 */
  week: number | null;
}

export interface SessionSpec {
  cwd: string;
  prompt: string;
  /** Appended to the Claude Code system prompt: the definition the automation runs */
  instructions: string;
  agents?: Record<string, AgentDefinition>;
  mcpServers?: Record<string, McpServerConfig>;
  /** Claude Code hooks of the run */
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  /** Resume an earlier session of the same run */
  resume?: string;
  limits: ResourceLimits;
  procgov: string;
  model?: string;
  onSessionId?: (id: string) => void;
  onAssistantText?: (text: string) => void;
  /** A hook's feedback, as the conversation carries it: what the run answers next answers it */
  onHookFeedback?: (text: string) => void;
  onUsage?: (usage: Usage) => void;
  onPid?: (pid: number) => void;
}

export interface SessionResult {
  sessionId: string | null;
  ok: boolean;
  error: string | null;
  usageBefore: Usage;
  usageAfter: Usage;
}

export interface SessionHandle {
  /** Steer the run: a message from the chat tool */
  send(text: string): boolean;
  interrupt(): Promise<void>;
  kill(): void;
  done: Promise<SessionResult>;
}

class InputQueue implements AsyncIterable<SDKUserMessage> {
  private items: SDKUserMessage[] = [];
  private waiting: ((r: IteratorResult<SDKUserMessage>) => void) | null = null;
  closed = false;

  push(text: string) {
    if (this.closed) return false;
    const msg: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
    } as SDKUserMessage;
    if (this.waiting) {
      const w = this.waiting;
      this.waiting = null;
      w({ value: msg, done: false });
    } else this.items.push(msg);
    return true;
  }

  close() {
    this.closed = true;
    if (this.waiting) {
      this.waiting({ value: undefined, done: true });
      this.waiting = null;
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: () => {
        const item = this.items.shift();
        if (item) return Promise.resolve({ value: item, done: false });
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => (this.waiting = resolve));
      },
    };
  }
}

const NO_USAGE: Usage = { fiveHour: null, week: null };

/** A rate limit event as Claude Code sends it: the limit it is about, and each window's use as a fraction of it */
interface RateLimitInfo {
  rateLimitType?: string;
  utilization?: number;
  unifiedWindows?: Partial<Record<'five_hour' | 'seven_day', { utilization?: number | null }>>;
}

/**
 * The reading a rate limit event carries, in percentage points like the usage call's. Claude Code reports both windows
 * under `unifiedWindows`; older versions only the one limit the event is about, as `utilization`. Both are fractions.
 */
export function usageOfRateLimit(info: RateLimitInfo): Usage {
  const pct = (f: number | null | undefined) => (typeof f === 'number' ? Math.round(f * 10_000) / 100 : null);
  const windows = info.unifiedWindows;
  if (windows) return { fiveHour: pct(windows.five_hour?.utilization), week: pct(windows.seven_day?.utilization) };
  if (info.rateLimitType === 'five_hour') return { fiveHour: pct(info.utilization), week: null };
  if (info.rateLimitType === 'seven_day') return { fiveHour: null, week: pct(info.utilization) };
  return NO_USAGE;
}

async function readUsage(q: Query): Promise<Usage> {
  try {
    const u = await q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true });
    return { fiveHour: u.rate_limits?.five_hour?.utilization ?? null, week: u.rate_limits?.seven_day?.utilization ?? null };
  } catch {
    return NO_USAGE;
  }
}

function assistantText(m: SDKMessage): string | null {
  if (m.type !== 'assistant') return null;
  const parts = (m.message.content as { type: string; text?: string }[])
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!);
  return parts.length ? parts.join('\n\n') : null;
}

/** A hook's message in the conversation: Claude Code adds it as the user's, after the turn it follows */
function hookFeedback(m: SDKMessage): string | null {
  if (m.type !== 'user' || typeof m.message.content === 'string') return null;
  const text = (m.message.content as { type: string; text?: string }[]).find((c) => c.type === 'text' && c.text?.startsWith('Stop hook feedback'));
  return text?.text ?? null;
}

export interface AskSpec {
  cwd: string;
  system: string;
  prompt: string;
  /** Claude Code's default when left out */
  model?: string;
  limits: ResourceLimits;
  procgov: string;
}

/** One question answered in one turn, with no tools and no project settings; the answer's text */
export async function ask(spec: AskSpec): Promise<string> {
  const q = query({
    prompt: spec.prompt,
    options: {
      cwd: spec.cwd,
      systemPrompt: spec.system,
      settingSources: [],
      tools: [],
      maxTurns: 1,
      persistSession: false,
      model: spec.model,
      spawnClaudeCodeProcess: spawnLimited({ limits: spec.limits, procgov: spec.procgov }),
    },
  });
  let text = '';
  for await (const m of q) {
    if (m.type === 'result') {
      if (m.subtype !== 'success' || m.is_error) throw new Error(m.subtype === 'success' ? m.result : m.subtype);
      text = m.result;
    }
  }
  return text;
}

/** One Claude Code process per run, through the Agent SDK, with the run's checkout as cwd */
export function startSession(spec: SessionSpec): SessionHandle {
  const input = new InputQueue();
  const abort = new AbortController();
  input.push(spec.prompt);

  const q = query({
    prompt: input,
    options: {
      cwd: spec.cwd,
      abortController: abort,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: spec.instructions },
      settingSources: ['project'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      agents: spec.agents,
      mcpServers: spec.mcpServers,
      hooks: spec.hooks,
      resume: spec.resume,
      model: spec.model,
      spawnClaudeCodeProcess: spawnLimited({ limits: spec.limits, procgov: spec.procgov, onPid: spec.onPid }),
    },
  });

  const done = (async (): Promise<SessionResult> => {
    let sessionId: string | null = null;
    let ok = true;
    let error: string | null = null;
    let usageBefore = NO_USAGE;
    let usageAfter = NO_USAGE;
    let first = true;
    try {
      for await (const m of q) {
        if (first) {
          first = false;
          usageBefore = await readUsage(q);
          spec.onUsage?.(usageBefore);
        }
        if (m.type === 'system' && m.subtype === 'init') {
          sessionId = m.session_id;
          spec.onSessionId?.(m.session_id);
        }
        const feedback = hookFeedback(m);
        if (feedback) spec.onHookFeedback?.(feedback);
        const text = assistantText(m);
        if (text) spec.onAssistantText?.(text);
        if (m.type === 'rate_limit_event') {
          const reading = usageOfRateLimit(m.rate_limit_info);
          if (reading.fiveHour !== null || reading.week !== null) spec.onUsage?.(reading);
        }
        if (m.type === 'result') {
          if (m.subtype !== 'success') {
            ok = false;
            error = m.subtype;
          } else if (m.is_error) {
            ok = false;
            error = m.result;
          }
          usageAfter = await readUsage(q);
          spec.onUsage?.(usageAfter);
          input.close();
        }
      }
    } catch (e) {
      ok = false;
      error = abort.signal.aborted ? 'killed' : (e as Error).message;
    } finally {
      input.close();
    }
    return { sessionId, ok, error, usageBefore, usageAfter };
  })();

  return {
    send: (text) => input.push(text),
    interrupt: async () => {
      await q.interrupt();
    },
    kill: () => {
      input.close();
      abort.abort();
    },
    done,
  };
}
