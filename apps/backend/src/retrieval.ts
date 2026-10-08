import type { RetrievalRating, ToolRating } from '@momentum/contract';
import { ask } from '@momentum/runs';
import { toolName } from './activity.ts';
import { config } from './config.ts';
import { SAY } from './protocol.ts';
import type { Workspace } from './workspaces.ts';

/** Rates a turn's retrieval; a short call over excerpts, it needs no stronger model */
export const RATER = 'haiku';
/** The calls a rating reads, and how much of each result */
const MAX_CALLS = 40;
const RESULT_EXCERPT = 1500;

/** Tools that change things or report to the harness; every other call brings information in */
const NOT_RETRIEVAL = new Set([
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'TodoWrite',
  'Task',
  'Agent',
  'mcp__momentum-kb__write',
  'mcp__momentum-kb__record_agent_metric',
]);

export const retrieves = (name: string) => !NOT_RETRIEVAL.has(name) && !name.startsWith('mcp__momentum-run__');

export interface RetrievalCall {
  name: string;
  /** The model response that made it */
  response: string | null;
  input: unknown;
  detail: string;
  result: string | null;
  error: boolean;
}

/** Whether two different retrieval tools were called side by side, in one model response */
export function calledInParallel(calls: RetrievalCall[]): boolean {
  const tools = new Map<string, Set<string>>();
  for (const c of calls) {
    if (!c.response) continue;
    const set = tools.get(c.response) ?? tools.set(c.response, new Set()).get(c.response)!;
    set.add(c.name);
  }
  return [...tools.values()].some((s) => s.size > 1);
}

/** The rater's instructions and the turn it rates: the question, the answer, and each call with what it brought back */
export function ratingQuestion(question: string, answer: string, calls: RetrievalCall[]): { system: string; prompt: string } {
  const system = `You ${SAY.rateRetrieval} with a coding agent: how relevant the information each tool call brought back was to the user's question, and how fully the calls together covered what the answer needed. Judge only what the calls returned, not the agent's answer itself.

Answer with JSON only, no prose and no code fence:
{"calls": [{"n": <call number>, "relevance": <0-5>}], "coverage": <0-1>, "tools": {"<tool>": "<what it contributed, at most 12 words>"}, "summary": "<one sentence on the retrieval>"}

Relevance: 0 nothing returned or an error, 1 unrelated, 2 loosely related, 3 useful context, 4 directly relevant, 5 the information the answer rests on. Coverage: 1 when everything the answer needed was retrieved, 0 when the answer needed facts no call returned. Rate every call.`;
  const listed = calls.slice(0, MAX_CALLS).map((c, i) => {
    const input = JSON.stringify(c.input ?? c.detail);
    const result = c.error ? `error: ${c.result ?? ''}` : c.result === null ? '(no result)' : c.result.slice(0, RESULT_EXCERPT);
    return `## Call ${i + 1}: ${toolName(c.name)}\nInput: ${input}\nResult${c.result && c.result.length > RESULT_EXCERPT ? ` (first ${RESULT_EXCERPT} of ${c.result.length} characters)` : ''}:\n${result}`;
  });
  const prompt = `# Question\n\n${question}\n\n# Answer\n\n${answer || '(none)'}\n\n# Calls\n\n${listed.join('\n\n')}`;
  return { system, prompt };
}

const clamp = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

/**
 * The rating from the rater's answer: each tool's relevance is the mean of its calls', and relative to the best tool's;
 * precision is the share of calls that brought back something useful (3 or more), the score the mean of precision and
 * coverage. Null when the answer does not hold a rating.
 */
export function parseRating(answer: string, calls: RetrievalCall[]): RetrievalRating | null {
  const json = /\{[\s\S]*\}/.exec(answer)?.[0];
  if (!json) return null;
  let raw: { calls?: { n?: unknown; relevance?: unknown }[]; coverage?: unknown; tools?: Record<string, unknown>; summary?: unknown };
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const rated = calls.slice(0, MAX_CALLS);
  const relevance = new Map<number, number>();
  for (const c of raw.calls ?? []) {
    const n = clamp(c.n, 1, rated.length);
    const r = clamp(c.relevance, 0, 5);
    if (n !== null && r !== null) relevance.set(Math.round(n) - 1, r);
  }
  const coverage = clamp(raw.coverage, 0, 1);
  if (relevance.size === 0 || coverage === null) return null;
  const byTool = new Map<string, number[]>();
  rated.forEach((c, i) => {
    const r = relevance.get(i) ?? (c.error ? 0 : null);
    if (r === null) return;
    (byTool.get(c.name) ?? byTool.set(c.name, []).get(c.name)!).push(r);
  });
  const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
  const best = Math.max(...[...byTool.values()].map(mean));
  const notes = raw.tools ?? {};
  const tools: ToolRating[] = [...byTool]
    .map(([name, rs]) => {
      const label = toolName(name);
      const note = notes[label] ?? notes[name];
      return {
        tool: label,
        calls: rs.length,
        relevance: Math.round(mean(rs) * 10) / 10,
        relative: best > 0 ? Math.round((mean(rs) / best) * 100) / 100 : 0,
        note: typeof note === 'string' ? note : '',
      };
    })
    .sort((a, b) => b.relevance - a.relevance || b.calls - a.calls);
  const all = [...relevance.values()];
  const precision = all.filter((r) => r >= 3).length / all.length;
  return {
    score: Math.round(((precision + coverage) / 2) * 100) / 100,
    precision: Math.round(precision * 100) / 100,
    coverage,
    parallel: calledInParallel(rated),
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    tools,
  };
}

/** A turn that retrieved anything waits for its rating, so the chat keeps asking for it; true when it does */
export async function awaitRating(ws: Workspace, runId: string, turn: number): Promise<boolean> {
  const t = (table: string) => ws.index.sql(`${ws.index.schema}.${table}`);
  const names = await ws.index.sql<{ name: string }[]>`select distinct name from ${t('run_step')}
    where run_id = ${runId} and turn = ${turn} and not bookkeeping`;
  if (!names.some((n) => retrieves(n.name))) return false;
  await ws.index.sql`update ${t('run_turn')} set retrieval_state = 'pending' where run_id = ${runId} and turn = ${turn}`;
  return true;
}

/**
 * The retrieval of a chat's turn, rated once the turn has ended: what the user asked, what the agent answered and every
 * call it made to bring information in before the harness's bookkeeping. The rating is kept on the turn, for the chat
 * to show, and recorded as the turn's RAG metric and each tool's.
 */
export async function rateRetrieval(ws: Workspace, run: { id: string; automation: string }, turn: number): Promise<void> {
  const t = (table: string) => ws.index.sql(`${ws.index.schema}.${table}`);
  const setState = (state: 'none' | 'rated', rating: RetrievalRating | null = null) =>
    ws.index.sql`update ${t('run_turn')} set retrieval_state = ${state}, retrieval = ${rating ? ws.index.sql.json(rating as never) : null}
      where run_id = ${run.id} and turn = ${turn}`;
  const steps = await ws.index.sql<{ name: string; response: string | null; input: unknown; detail: string; result: string | null; error: boolean }[]>`
    select name, response, input, detail, result, error from ${t('run_step')}
    where run_id = ${run.id} and turn = ${turn} and not bookkeeping order by seq`;
  const calls = steps.filter((s) => retrieves(s.name));
  if (calls.length === 0) return void (await setState('none'));
  try {
    const [bounds] = await ws.index.sql<{ after_seq: number; before: number | null; next: number | null }[]>`
      select after_seq,
        (select after_seq from ${t('run_turn')} p where p.run_id = ${run.id} and p.turn = ${turn - 1}) as before,
        (select min(seq) from ${t('run_message')} m where m.run_id = ${run.id} and m.role = 'user' and m.seq > c.after_seq) as next
      from ${t('run_turn')} c where c.run_id = ${run.id} and c.turn = ${turn}`;
    if (!bounds) return void (await setState('none'));
    const messages = await ws.index.sql<{ seq: number; role: string; text: string }[]>`
      select seq, role, text from ${t('run_message')} where run_id = ${run.id} and seq > ${bounds.before ?? 0} order by seq`;
    const question = messages.filter((m) => m.role === 'user' && m.seq <= bounds.after_seq).map((m) => m.text).join('\n\n');
    const answer = messages
      .filter((m) => m.role === 'assistant' && m.seq > bounds.after_seq && (bounds.next === null || m.seq < bounds.next))
      .map((m) => m.text)
      .join('\n\n');
    const q = ratingQuestion(question, answer, calls);
    const rating = parseRating(await ask({ cwd: ws.path, ...q, model: RATER, limits: config.limits, procgov: config.procgov }), calls);
    if (!rating) return void (await setState('none'));
    await setState('rated', rating);
    await ws.index.sql`insert into ${t('rag_metric')} ${ws.index.sql({
      run_id: run.id,
      turn,
      automation: run.automation,
      score: rating.score,
      precision: rating.precision,
      coverage: rating.coverage,
      parallel: rating.parallel,
    })} on conflict (run_id, turn) do nothing`;
    for (const tool of rating.tools) {
      await ws.index.sql`insert into ${t('retrieval_metric')} ${ws.index.sql({
        run_id: run.id,
        turn,
        automation: run.automation,
        tool: tool.tool,
        calls: tool.calls,
        relevance: tool.relevance,
        relative: tool.relative,
      })}`;
    }
  } catch (e) {
    await setState('none').catch(() => {});
    throw e;
  }
}
