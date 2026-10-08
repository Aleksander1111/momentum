import type { RetrievalRating, RunStep, RunTurn } from '@momentum/contract';
import type { Tokens, ToolResult, ToolUse } from '@momentum/runs';
import { Serial } from './serial.ts';
import type { Workspace } from './workspaces.ts';

/** What of a tool's result is kept for rating the retrieval: the rater reads the start of each */
const RESULT_CHARS = 4000;
/** A tool's input is kept for the rater when it is short: a query, a path, a pattern; a file's content is not */
const INPUT_CHARS = 2000;
const DETAIL_CHARS = 160;

/** "mcp__momentum-kb__search" → "momentum-kb · search"; Claude Code's own tools keep their names */
export function toolName(name: string): string {
  const m = /^mcp__(.+?)__(.+)$/.exec(name);
  return m ? `${m[1]} · ${m[2]}` : name;
}

const oneLine = (s: string) => {
  const line = s.replace(/\s+/g, ' ').trim();
  return line.length > DETAIL_CHARS ? `${line.slice(0, DETAIL_CHARS - 1)}…` : line;
};

/** What a tool was called on, in a line, as Claude Code shows it: the file, the pattern, the command, the query */
export function toolDetail(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof i[k] === 'string' ? (i[k] as string) : null);
  const pick = (...keys: string[]) => keys.map(str).find((v) => v) ?? null;
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return oneLine(pick('file_path', 'notebook_path') ?? '');
    case 'Grep':
      return oneLine([str('pattern'), str('path') ?? str('glob')].filter(Boolean).join(' in '));
    case 'Glob':
      return oneLine([str('pattern'), str('path')].filter(Boolean).join(' in '));
    case 'Bash':
    case 'PowerShell':
      return oneLine(pick('description', 'command') ?? '');
    case 'Task':
    case 'Agent':
      return oneLine([str('subagent_type'), str('description')].filter(Boolean).join(': '));
    case 'WebSearch':
      return oneLine(str('query') ?? '');
    case 'WebFetch':
      return oneLine(str('url') ?? '');
  }
  const first = pick('query', 'path', 'pattern', 'file_path', 'url', 'name') ?? Object.values(i).find((v): v is string => typeof v === 'string');
  return oneLine(first ?? '');
}

/**
 * What a run is doing, as it does it: each turn, from the user's message to the end of its session, with every tool it
 * calls and the tokens it reads and writes. The app shows it while the user waits; the retrieval of a turn is rated
 * from it once the turn has ended. Writes of one run go one after another, so a result never lands before its call.
 */
export class Activity {
  private writes = new Serial();
  private seq = 0;
  /** The tokens of each model response: the context it read and what it wrote, the latest reading of each */
  private responses = new Map<string, Tokens>();
  private lastInput = 0;

  private constructor(
    private readonly ws: Workspace,
    readonly runId: string,
    readonly turn: number,
  ) {}

  private t(table: string) {
    return this.ws.index.sql(`${this.ws.index.schema}.${table}`);
  }

  /** A new turn of the run, answering the last message the user wrote */
  static async begin(ws: Workspace, runId: string): Promise<Activity> {
    const t = (table: string) => ws.index.sql(`${ws.index.schema}.${table}`);
    const [r] = await ws.index.sql<{ turn: number }[]>`insert into ${t('run_turn')} (run_id, turn, after_seq)
      values (${runId},
        (select coalesce(max(turn), 0) + 1 from ${t('run_turn')} where run_id = ${runId}),
        (select coalesce(max(seq), 0) from ${t('run_message')} where run_id = ${runId} and role = 'user'))
      returning turn`;
    return new Activity(ws, runId, r!.turn);
  }

  private write(fn: () => Promise<unknown>): void {
    void this.writes.run(this.runId, fn).catch((e) => console.error(`activity of run ${this.runId}:`, e));
  }

  use(u: ToolUse, bookkeeping: boolean): void {
    const seq = ++this.seq;
    const json = JSON.stringify(u.input ?? {});
    const input = json.length <= INPUT_CHARS ? (u.input as never) : null;
    this.write(
      () => this.ws.index.sql`insert into ${this.t('run_step')} ${this.ws.index.sql({
        run_id: this.runId,
        id: u.id,
        turn: this.turn,
        seq,
        parent: u.parent,
        response: u.response,
        name: u.name,
        detail: toolDetail(u.name, u.input),
        input: input === null ? null : this.ws.index.sql.json(input),
        bookkeeping,
      })} on conflict (run_id, id) do nothing`,
    );
  }

  result(r: ToolResult): void {
    this.write(
      () => this.ws.index.sql`update ${this.t('run_step')} set ended_at = now(), error = ${r.error},
        result_chars = ${r.text.length}, result = ${r.text.slice(0, RESULT_CHARS)} where run_id = ${this.runId} and id = ${r.id}`,
    );
  }

  tokens(id: string, t: Tokens): void {
    const before = this.responses.get(id);
    if (before && before.output >= t.output && before.input === t.input) return;
    this.responses.set(id, { input: t.input, output: Math.max(t.output, before?.output ?? 0) });
    if (t.input > 0) this.lastInput = t.input;
    const output = [...this.responses.values()].reduce((a, r) => a + r.output, 0);
    const context = this.lastInput;
    this.write(
      () => this.ws.index.sql`update ${this.t('run_turn')} set context_tokens = ${context}, output_tokens = ${output}
        where run_id = ${this.runId} and turn = ${this.turn}`,
    );
  }

  /** Text for the user arrived: the turn has answered, so far */
  answered(): void {
    this.write(() => this.ws.index.sql`update ${this.t('run_turn')} set answered_at = now() where run_id = ${this.runId} and turn = ${this.turn}`);
  }

  /** The session ended: calls it never saw the result of end with it */
  async end(): Promise<void> {
    await this.writes.run(this.runId, async () => {
      await this.ws.index.sql`update ${this.t('run_turn')} set ended_at = now() where run_id = ${this.runId} and turn = ${this.turn}`;
      await this.ws.index.sql`update ${this.t('run_step')} set ended_at = now() where run_id = ${this.runId} and turn = ${this.turn} and ended_at is null`;
    });
  }
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** The turns of a run, each with its tool calls in the order they were made */
export async function turnsOf(ws: Workspace, runId: string): Promise<RunTurn[]> {
  const t = (table: string) => ws.index.sql(`${ws.index.schema}.${table}`);
  const turns = await ws.index.sql<
    {
      turn: number;
      after_seq: number;
      started_at: Date;
      answered_at: Date | null;
      ended_at: Date | null;
      context_tokens: number;
      output_tokens: number;
      retrieval_state: RunTurn['retrievalState'];
      retrieval: RetrievalRating | null;
    }[]
  >`select turn, after_seq, started_at, answered_at, ended_at, context_tokens, output_tokens, retrieval_state, retrieval
    from ${t('run_turn')} where run_id = ${runId} order by turn`;
  if (turns.length === 0) return [];
  const steps = await ws.index.sql<
    {
      id: string;
      turn: number;
      parent: string | null;
      name: string;
      detail: string;
      bookkeeping: boolean;
      started_at: Date;
      ended_at: Date | null;
      error: boolean;
      result_chars: number | null;
    }[]
  >`select id, turn, parent, name, detail, bookkeeping, started_at, ended_at, error, result_chars
    from ${t('run_step')} where run_id = ${runId} order by turn, seq`;
  return turns.map((r) => ({
    turn: r.turn,
    afterSeq: r.after_seq,
    startedAt: r.started_at.toISOString(),
    answeredAt: iso(r.answered_at),
    endedAt: iso(r.ended_at),
    contextTokens: r.context_tokens,
    outputTokens: r.output_tokens,
    retrievalState: r.retrieval_state,
    retrieval: r.retrieval,
    steps: steps
      .filter((s) => s.turn === r.turn)
      .map(
        (s): RunStep => ({
          id: s.id,
          parent: s.parent,
          name: toolName(s.name),
          detail: s.detail,
          bookkeeping: s.bookkeeping,
          startedAt: s.started_at.toISOString(),
          endedAt: iso(s.ended_at),
          error: s.error,
          resultChars: s.result_chars,
        }),
      ),
  }));
}
