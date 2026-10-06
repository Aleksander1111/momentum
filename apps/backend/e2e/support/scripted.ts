import { post } from '../observer/post.ts';
import { addTokens, emptyTokens, tokensOf, type Tokens } from '../observer/usage-fit.ts';
import { appendFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { join } from 'node:path';

/**
 * A stand-in for the Claude API that the Claude Code processes of a scenario talk to: every run is real Claude Code,
 * with the harness's hooks, MCP servers, checkout and landing, but what the model "decides" is scripted by the
 * scenario. Runs end, fail, hang or write exactly what a real-life situation needs, and use none of the account's
 * limits.
 *
 * Each request is answered from the conversation it carries, so nothing is kept per run: the turn is the last thing the
 * user (or a harness hook) said, and the number of assistant replies since then picks the next move of its script.
 *
 * Live (E2E_LIVE=1), no answer is scripted: every request goes to the real Claude API as Claude Code sent it, and the
 * real answer comes back and is recorded in the world's model.log. What still applies is the network's part, never the
 * model's: a script's gate holds the run's first answer of a turn until the scenario opens it, and a script that answers
 * with faults alone (an error status or a hang, see `faults`) injects that fault in place of the request reaching the
 * API, like an outage would.
 */

export type TurnKind = 'prompt' | 'message' | 'resume' | 'summarize' | 'commit-message' | 'guard';

export interface Turn {
  run: string;
  automation: string;
  trigger: string;
  checkout: string;
  target: string | null;
  kind: TurnKind;
  /** What started this turn: the run's prompt, the user's message or the hook's request */
  input: string;
  /** Every turn input of the conversation so far, oldest first */
  inputs: string[];
  /** What a PostToolUse hook told the run about its writes so far in this turn */
  hookContext: string[];
  /** Files the run wrote or edited so far in the conversation, relative to the checkout, with forward slashes */
  wrote: string[];
  /** How many replies the model gave in this turn before this one: which move of the script is next */
  step: number;
  /** What the tools the model called in this turn answered, oldest first: a script decides its next move on them */
  results: { tool: string; input: unknown; text: string }[];
  /** A file of the checkout, for moves */
  file(path: string): string;
}

/** One reply of the model: tools it calls, text it says, or something going wrong */
export type Move =
  | { text: string }
  | { tool: string; input: Record<string, unknown> }
  /** Accept the request and never answer: the run stays running */
  | { hang: true }
  /** Answer only once the scenario opens the gate: the run is busy until then */
  | { gate: Promise<unknown> }
  /** The API answers with an error status */
  | { error: number; message?: string };

export type Script = (t: Turn) => Move[] | undefined;

export interface Entity {
  type: string;
  title: string;
  card: string;
  verification?: 'verified' | 'unverified';
  origin?: 'user' | 'requested' | 'automation';
  impact?: [number, number, number];
  references?: { to: string; relation: string }[];
  artifacts?: string[];
  extra?: Record<string, unknown>;
}

/** An entity file as a run writes it */
export function entityText(e: Entity): string {
  const [p, t, u] = e.impact ?? [2, 2, 2];
  const refs = e.references?.length ? `\n${e.references.map((r) => `  - to: ${r.to}\n    relation: ${r.relation}`).join('\n')}` : ' []';
  const arts = e.artifacts?.length ? `\n${e.artifacts.map((a) => `  - ${a}`).join('\n')}` : ' []';
  const extra = Object.entries(e.extra ?? {})
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v)}`)
    .join('\n');
  return `---
type: ${e.type}
origin: ${e.origin ?? 'automation'}
verification: ${e.verification ?? 'unverified'}
product_impact: ${p}
timeline_impact: ${t}
unlocks: ${u}
references:${refs}
artifacts:${arts}${extra ? `\n${extra}` : ''}
---
# ${e.title}

${e.card}
`;
}

/** Moves a script is made of */
export const move = {
  say: (text: string): Move => ({ text }),
  write: (t: Turn, path: string, content: string): Move => ({ tool: 'Write', input: { file_path: t.file(path), content } }),
  entity: (t: Turn, path: string, e: Entity): Move => ({ tool: 'Write', input: { file_path: t.file(`knowledge-graph/${path}.md`), content: entityText(e) } }),
  bash: (command: string): Move => ({ tool: 'Bash', input: { command, description: 'Scripted command' } }),
  remove: (t: Turn, path: string): Move => ({ tool: 'Bash', input: { command: `rm -f "${t.file(path).replaceAll('\\', '/')}"`, description: 'Remove a file' } }),
  graphBuild: (v: { complete: boolean; progress: string; coverage: number; documents?: string[] }): Move => ({
    tool: 'mcp__momentum-run__report_graph_build',
    input: v,
  }),
  interview: (v: { question: string; done: boolean; document: string }): Move => ({ tool: 'mcp__momentum-run__report_interview', input: v }),
  metric: (misalignments: number, recurring_issues: number): Move => ({ tool: 'mcp__momentum-kb__record_agent_metric', input: { misalignments, recurring_issues } }),
  hang: (): Move => ({ hang: true }),
  gate: (open: Promise<unknown>): Move => ({ gate: open }),
  error: (status: number, message = 'Overloaded'): Move => ({ error: status, message }),
};

interface Message {
  role: string;
  content: string | { type: string; text?: string; content?: unknown; name?: string; input?: { file_path?: string; path?: string } }[];
}

const isFault = (m: Move) => 'hang' in m || 'error' in m;
/** Moves that are the network failing, not the model answering: they apply live too, at whatever step they come */
export const faults = (moves: Move[]) => moves.some(isFault) && moves.every((m) => isFault(m) || 'gate' in m);

/** The files the run's tool calls wrote, relative to the checkout */
function written(messages: Message[], checkout: string): string[] {
  const slash = (p: string) => p.replaceAll('\\', '/');
  const root = `${slash(checkout).replace(/\/$/, '')}/`.toLowerCase();
  const out: string[] = [];
  for (const m of messages) {
    if (m.role !== 'assistant' || typeof m.content === 'string') continue;
    for (const c of m.content) {
      if (c.type !== 'tool_use') continue;
      // The knowledge base's own write tool takes the entity's path
      if (c.name?.endsWith('__write') && c.input?.path) {
        out.push(`knowledge-graph/${c.input.path.replace(/\.md$/, '')}.md`);
        continue;
      }
      if (!['Write', 'Edit', 'MultiEdit'].includes(c.name ?? '') || !c.input?.file_path) continue;
      const f = slash(c.input.file_path);
      out.push(f.toLowerCase().startsWith(root) ? f.slice(root.length) : f);
    }
  }
  return out;
}

/** What each tool the model called answered, in order: the tool_result blocks matched to their tool_use by id */
function toolResults(messages: Message[]): { tool: string; input: unknown; text: string }[] {
  const calls = new Map<string, { tool: string; input: unknown }>();
  const out: { tool: string; input: unknown; text: string }[] = [];
  for (const m of messages) {
    if (typeof m.content === 'string') continue;
    for (const c of m.content as { type: string; id?: string; name?: string; input?: unknown; tool_use_id?: string; content?: unknown }[]) {
      if (m.role === 'assistant' && c.type === 'tool_use' && c.id) calls.set(c.id, { tool: c.name ?? '', input: c.input });
      if (m.role !== 'user' || c.type !== 'tool_result') continue;
      const call = calls.get(c.tool_use_id ?? '') ?? { tool: '', input: undefined };
      const text =
        typeof c.content === 'string'
          ? c.content
          : ((c.content as { type: string; text?: string }[] | undefined) ?? []).map((b) => b.text ?? '').join('\n');
      out.push({ ...call, text });
    }
  }
  return out;
}

const textsOf = (m: Message): string[] =>
  typeof m.content === 'string' ? [m.content] : m.content.filter((c) => c.type === 'text' && c.text).map((c) => c.text!);
const isToolResult = (m: Message) => typeof m.content !== 'string' && m.content.some((c) => c.type === 'tool_result');
const own = (text: string) => !text.trimStart().startsWith('<system-reminder>');

/** What the user, or a hook speaking for the harness, said in a message; null for tool results and reminders */
function said(m: Message): string | null {
  if (m.role !== 'user' || isToolResult(m)) return null;
  const parts = textsOf(m).filter(own);
  return parts.length ? parts.join('\n\n') : null;
}

const RESUME = 'The harness restarted while you were working';

function kindOf(input: string, first: boolean): TurnKind {
  if (input.includes('have the momentum-summarization sub-agent summarize')) return 'summarize';
  if (input.includes('write the commit message your changes land on the main line with')) return 'commit-message';
  if (input.includes('the consistency guard cannot accept these knowledge-base changes')) return 'guard';
  if (input.includes(RESUME)) return 'resume';
  return first ? 'prompt' : 'message';
}

/** Where the hook asks the commit message to go */
export const messageFileOf = (input: string) => /write the commit message .*? to (.+?), replacing what it holds/s.exec(input)?.[1]?.trim() ?? null;

interface Logged {
  run: string;
  automation: string;
  kind: TurnKind;
  input: string;
  step: number;
  /** Whether the guard had told the run its last write would not be accepted */
  flagged: boolean;
  move: string;
  at: Date;
}

/** Where live requests go */
const API = 'https://api.anthropic.com';
/** Headers that belong to one hop, not to the request or answer passed on */
const HOP = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding', 'content-encoding', 'keep-alive']);

/** What a live answer said and did, from its JSON or event stream, for the log */
/** Tokens a scenario's runs used on the real API, and what they would cost there: the measure of its share of the limits */
export interface Spent {
  requests: number;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  /** US dollars at the API's list prices, all models: for reference only, the limit does not follow prices */
  usd: number;
  /** Tokens by model group and kind: what the 5-hour limit is fitted against */
  tokens: Tokens;
}

/** List prices per million input and output tokens; writing the cache costs 1.25 times input, reading it 0.1 times */
const PRICES: [RegExp, number, number][] = [
  [/opus/i, 5, 25],
  [/sonnet/i, 3, 15],
  [/haiku/i, 1, 5],
];

/** What one answer used, from its usage fields: streamed in message_start and message_delta, or on the plain message */
export function spentOf(body: string): Omit<Spent, 'requests' | 'tokens'> & { model: string } {
  const parts = body.startsWith('{') ? [body] : body.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6));
  let model = '';
  const u = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  for (const p of parts) {
    try {
      type Usage = { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
      const e = JSON.parse(p) as { model?: string; usage?: Usage; message?: { model?: string; usage?: Usage } };
      const usage = e.message?.usage ?? e.usage;
      model ||= e.message?.model ?? e.model ?? '';
      if (!usage) continue;
      // Each event carries the count so far: the last one of each kind holds
      if (usage.input_tokens) u.input = usage.input_tokens;
      if (usage.output_tokens) u.output = usage.output_tokens;
      if (usage.cache_creation_input_tokens) u.cacheWrite = usage.cache_creation_input_tokens;
      if (usage.cache_read_input_tokens) u.cacheRead = usage.cache_read_input_tokens;
    } catch {
      // not an event
    }
  }
  const [, inPrice, outPrice] = PRICES.find(([re]) => re.test(model)) ?? PRICES[1]!;
  const usd = (u.input * inPrice + u.cacheWrite * inPrice * 1.25 + u.cacheRead * inPrice * 0.1 + u.output * outPrice) / 1e6;
  return { ...u, usd, model };
}

function summary(body: string): string {
  // A streamed answer is events, one JSON per data line; a plain one is the message itself
  const parts = body.startsWith('{') ? [body] : body.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6));
  let text = '';
  const tools: string[] = [];
  for (const p of parts) {
    try {
      const e = JSON.parse(p) as { delta?: { text?: string }; content_block?: { type: string; name?: string }; content?: { type: string; text?: string; name?: string }[] };
      if (e.delta?.text) text += e.delta.text;
      if (e.content_block?.type === 'tool_use') tools.push(e.content_block.name ?? '');
      for (const b of e.content ?? []) {
        if (b.type === 'text') text += b.text ?? '';
        if (b.type === 'tool_use') tools.push(b.name ?? '');
      }
    } catch {
      // not an event
    }
  }
  return JSON.stringify({ tools, text: text.slice(0, 400) });
}

export class ScriptedModel {
  private server: Server;
  private sockets = new Set<Socket>();
  private scripts: { name: string; when: (t: Turn) => boolean; script: Script }[] = [];
  /** Every request a run made, with the move it got */
  readonly log: Logged[] = [];
  /** The instructions each run was started with: the definition and the harness's facts */
  readonly instructions = new Map<string, string>();
  /** Requests that were not a run's: the risk estimator, titles and other side questions */
  readonly side: { system: string; prompt: string }[] = [];
  /** How the risk estimator answers, from its system prompt and question */
  risk: (prompt: string) => string = () => 'medium';
  /** The commit subject a run writes when the harness asks for one; null leaves the message file empty */
  subject: (t: Turn) => string | null = (t) => `Scripted ${t.automation} work`;
  private n = 0;
  /** The scenario whose runs this stand-in answers: its answers count to it */
  scenario = '';
  /** What the answers forwarded to the real API used */
  readonly spent: Spent = { requests: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, usd: 0, tokens: emptyTokens() };
  private dump: string | null;
  private closed = false;
  /** Aborts the live requests still under way when the scenario ends */
  private inFlight = new AbortController();
  /** Requests wait until the scenario has said what the runs do: runs due at once start before it begins */
  private held: (() => void)[] | null = [];

  constructor(
    dir?: string,
    /** Every request to the real API: nothing scripted */
    readonly live = false,
  ) {
    this.dump = dir ? join(dir, 'model.log') : null;
    this.server = createServer((req, res) => void this.handle(req, res));
    this.server.on('connection', (s) => {
      this.sockets.add(s);
      s.on('close', () => this.sockets.delete(s));
    });
  }

  async listen(): Promise<string> {
    await new Promise<void>((ok) => this.server.listen(0, '127.0.0.1', ok));
    return `http://127.0.0.1:${(this.server.address() as { port: number }).port}`;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.inFlight.abort();
    for (const s of this.sockets) s.destroy();
    await new Promise<void>((ok) => this.server.close(() => ok()));
  }

  /**
   * What runs do: the first script registered whose `when` matches the turn and that returns moves decides it. Turns no
   * script takes get the default: say "Done." to prompts and messages, write the commit message the harness asks for,
   * and stop on anything else.
   */
  on(name: string, when: Partial<Pick<Turn, 'automation' | 'kind' | 'run' | 'target'>> | ((t: Turn) => boolean), script: Script): void {
    const match =
      typeof when === 'function'
        ? when
        : (t: Turn) => Object.entries(when).every(([k, v]) => (t as unknown as Record<string, unknown>)[k] === v);
    this.scripts.unshift({ name, when: match, script });
  }

  /** Lets the requests through that arrived before the scenario's scripts */
  release(): void {
    const held = this.held ?? [];
    this.held = null;
    for (const go of held) go();
  }

  /** Turns of a run seen so far */
  turns(run: string): Logged[] {
    return this.log.filter((l) => l.run === run);
  }

  private moves(t: Turn): Move[] {
    for (const s of this.scripts) {
      if (!s.when(t)) continue;
      const m = s.script(t);
      if (m) return m;
    }
    if (t.kind === 'commit-message') {
      const file = messageFileOf(t.input);
      const subject = this.subject(t);
      return file && subject ? [{ tool: 'Write', input: { file_path: file, content: `${subject}\n` } }, { text: 'Described.' }] : [{ text: 'Done.' }];
    }
    return [{ text: 'Done.' }];
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let raw = '';
    for await (const c of req) raw += c;
    if (this.held) await new Promise<void>((go) => this.held?.push(go) ?? go());
    if (this.live && !req.url?.startsWith('/v1/messages')) return void (await this.forward(req, raw, res));
    if (!req.url?.startsWith('/v1/messages')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return void res.end('{}');
    }
    if (this.live && req.url.includes('count_tokens')) return void (await this.forward(req, raw, res));
    if (req.url.includes('count_tokens')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return void res.end(JSON.stringify({ input_tokens: 100 }));
    }
    const body = JSON.parse(raw) as { model: string; stream?: boolean; system?: string | { text: string }[]; messages: Message[]; tools?: unknown[] };
    const system = typeof body.system === 'string' ? body.system : (body.system ?? []).map((s) => s.text).join('\n');
    const id = ++this.n;
    const run = /^- Run: (\w+), automation ([\w-]+), started by (\w+)(?:, target entity (\S+))?$/m.exec(system);
    if (!run || !body.tools?.length) {
      const prompt = body.messages.flatMap(textsOf).filter(own).join('\n');
      this.side.push({ system, prompt });
      if (this.live) return void (await this.forward(req, raw, res));
      const answer = /estimate the risk of an implementation/.test(system) ? this.risk(prompt) : 'OK';
      return this.reply(res, body, id, [{ text: answer }]);
    }
    const checkout = /this checkout: (.+?); main line:/.exec(system)?.[1] ?? '';
    if (!this.instructions.has(run[1]!)) this.instructions.set(run[1]!, system);
    const inputs: number[] = [];
    body.messages.forEach((m, i) => {
      if (said(m) !== null) inputs.push(i);
    });
    const at = inputs.at(-1) ?? 0;
    const input = said(body.messages[at]!) ?? '';
    const step = body.messages.slice(at + 1).filter((m) => m.role === 'assistant').length;
    const turn: Turn = {
      run: run[1]!,
      automation: run[2]!,
      trigger: run[3]!,
      target: run[4] ?? null,
      checkout,
      kind: kindOf(input, inputs.length <= 1),
      input,
      inputs: inputs.map((i) => said(body.messages[i]!)!),
      hookContext: body.messages
        .slice(at + 1)
        .flatMap((m) => (m.role === 'system' || m.role === 'user' ? textsOf(m) : []))
        .filter((x) => x.includes('consistency guard will not accept')),
      wrote: written(body.messages, checkout),
      step,
      results: toolResults(body.messages.slice(at + 1)),
      file: (p) => join(checkout, p),
    };
    let moves: Move[];
    try {
      moves = this.moves(turn);
    } catch (e) {
      // A script that throws must not leave the run waiting on an answer that never comes
      this.write({ run: turn.run, scriptFailed: (e as Error).message, at: new Date() });
      if (!this.live) return this.reply(res, body, id, [{ error: 500, message: `The script failed: ${(e as Error).message}` }]);
      moves = [];
    }
    // A fault is the network's: it applies at any step, scripted or live
    if (faults(moves)) {
      const injected = moves.filter(isFault);
      const entry = { run: turn.run, automation: turn.automation, kind: turn.kind, input, step, flagged: turn.hookContext.length > 0, move: `injected ${JSON.stringify(injected)}`, at: new Date() };
      this.log.push(entry);
      this.write(entry);
      for (const m of moves) if ('gate' in m) await m.gate;
      return this.reply(res, body, id, injected);
    }
    if (this.live) {
      const entry = { run: turn.run, automation: turn.automation, kind: turn.kind, input, step, flagged: turn.hookContext.length > 0, move: '', at: new Date() };
      this.log.push(entry);
      // Timing is the scenario's: a gate on the turn's first answer still holds it; what is answered is the model's
      if (step === 0) for (const m of moves) if ('gate' in m) await m.gate;
      entry.move = await this.forward(req, raw, res);
      this.write(entry);
      return;
    }
    // Text before a tool call goes with it, and so does a gate; text at the end ends the turn
    const replies: Move[][] = [];
    let pending: Move[] = [];
    for (const m of moves) {
      pending.push(m);
      if (!('text' in m) && !('gate' in m)) {
        replies.push(pending);
        pending = [];
      }
    }
    if (pending.length) replies.push(pending);
    const replied = replies[step] ?? [{ text: 'Done.' }];
    const entry = { run: turn.run, automation: turn.automation, kind: turn.kind, input, step, flagged: turn.hookContext.length > 0, move: JSON.stringify(replied).slice(0, 300), at: new Date() };
    this.log.push(entry);
    this.write(entry);
    for (const m of replied) if ('gate' in m) await m.gate;
    return this.reply(res, body, id, replied.filter((m) => !('gate' in m)));
  }

  /** Passes the request to the real API and its answer back as it streams; what it answered, for the log */
  private async forward(req: IncomingMessage, raw: string, res: ServerResponse): Promise<string> {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined && !HOP.has(k)) headers[k] = Array.isArray(v) ? v.join(', ') : v;
    let answer: Response;
    try {
      answer = await fetch(`${API}${req.url}`, {
        method: req.method,
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : raw,
        signal: this.inFlight.signal,
      });
    } catch (e) {
      if (this.closed) return 'ended with the scenario';
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: `The Claude API could not be reached: ${(e as Error).message}` } }));
      return 'unreachable';
    }
    const out: Record<string, string> = {};
    answer.headers.forEach((v, k) => {
      if (!HOP.has(k)) out[k] = v;
    });
    res.writeHead(answer.status, out);
    let body = '';
    try {
      if (answer.body) {
        const decoder = new TextDecoder();
        for await (const chunk of answer.body) {
          res.write(chunk);
          body += decoder.decode(chunk, { stream: true });
        }
      }
    } catch (e) {
      // The scenario ended mid-answer, or the API dropped it: the run sees the connection close
      res.destroy();
      return this.closed ? 'ended with the scenario' : `dropped: ${(e as Error).message}`;
    }
    res.end();
    const used = spentOf(body);
    this.spent.requests++;
    for (const k of ['input', 'output', 'cacheWrite', 'cacheRead', 'usd'] as const) this.spent[k] += used[k];
    const tokens = tokensOf(used.model, { input_tokens: used.input, output_tokens: used.output, cache_creation_input_tokens: used.cacheWrite, cache_read_input_tokens: used.cacheRead });
    addTokens(this.spent.tokens, tokens);
    // The 5-hour limit as the API reports it right after this answer: one more point for the runner's fit
    const u = answer.headers.get('anthropic-ratelimit-unified-5h-utilization');
    const resets = answer.headers.get('anthropic-ratelimit-unified-5h-reset');
    if (used.model) void post({ type: 'answer', scenario: this.scenario, t: Date.now(), u: u === null ? null : Math.round(Number(u) * 100), resets: resets === null ? null : Number(resets), tokens }).catch(() => {});
    this.write({ live: req.url, status: answer.status, at: new Date(), body });
    return `${answer.status} ${summary(body)}`;
  }

  /** A line of model.log; none once the scenario has ended, when its world may be gone */
  private write(line: object): void {
    if (this.dump && !this.closed) appendFileSync(this.dump, `${JSON.stringify(line)}\n`);
  }

  private reply(res: ServerResponse, body: { model: string; stream?: boolean }, id: number, moves: Move[]): void {
    if (moves.some((m) => 'hang' in m)) return; // the connection stays open, unanswered
    const failure = moves.find((m): m is { error: number; message?: string } => 'error' in m);
    if (failure) {
      res.writeHead(failure.error, { 'content-type': 'application/json', 'x-should-retry': 'false' });
      return void res.end(JSON.stringify({ type: 'error', error: { type: failure.error === 529 ? 'overloaded_error' : 'api_error', message: failure.message ?? 'Scripted failure' } }));
    }
    const blocks = moves.map((m, i) =>
      'text' in m ? { type: 'text', text: m.text } : { type: 'tool_use', id: `toolu_s${id}_${i}`, name: (m as { tool: string }).tool, input: (m as { input: unknown }).input },
    );
    const stop = blocks.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn';
    const usage = { input_tokens: 100, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
    const message = { id: `msg_s${id}`, type: 'message', role: 'assistant', model: body.model, stop_reason: null, stop_sequence: null, usage };
    if (!body.stream) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return void res.end(JSON.stringify({ ...message, content: blocks, stop_reason: stop }));
    }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const ev = (type: string, data: object) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    ev('message_start', { message: { ...message, content: [] } });
    blocks.forEach((b, index) => {
      if (b.type === 'text') {
        ev('content_block_start', { index, content_block: { type: 'text', text: '' } });
        ev('content_block_delta', { index, delta: { type: 'text_delta', text: b.text } });
      } else {
        ev('content_block_start', { index, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
        ev('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } });
      }
      ev('content_block_stop', { index });
    });
    ev('message_delta', { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 10 } });
    ev('message_stop', {});
    res.end();
  }
}
