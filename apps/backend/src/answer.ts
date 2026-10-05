import type { AskResponse, ModelSettings, SearchResult } from '@momentum/contract';
import { entityLinks } from '@momentum/entity';
import type { Embed } from '@momentum/kb';
import { ask, show } from '@momentum/runs';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config.ts';
import { sdkModel, setModel } from './models.ts';
import type { Workspace, Workspaces } from './workspaces.ts';

/** The entities an answer reads: the best hits, with the entities their references bring in */
const SOURCES = 10;
/** A card is short by rule; this only guards the prompt against one that is not */
const CARD_CHARS = 2400;
/** The same question again soon after is answered from memory: typing, voice and a second device ask it more than once */
const KEPT_MS = 10 * 60_000;
const KEPT = 200;

/** The definition of the search automation, as it ships: used until the user has approved one */
const DEFINITION = 'automations/search/agents/momentum-search.md';

function instructionsOf(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
}

/**
 * Questions asked of the knowledge graph, as a search page answers them above its results: the search finds the
 * entities, then one turn of the search automation answers from them, linking every entity it draws from.
 */
export class Answers {
  private kept = new Map<string, { at: number; answer: Promise<AskResponse> }>();

  constructor(
    private readonly workspaces: Workspaces,
    private readonly embed: Embed,
    private readonly models: () => Promise<ModelSettings>,
  ) {}

  /** The search automation's instructions: approved and materialized in the workspace, or as the harness ships them */
  private async instructions(ws: Workspace): Promise<string> {
    const materialized = join(ws.path, '.claude', 'agents', 'momentum-search.md');
    if (existsSync(materialized)) return instructionsOf(await readFile(materialized, 'utf8'));
    const harness = await this.workspaces.harness();
    const text = await show(harness.path, `refs/heads/${harness.main}`, DEFINITION);
    if (text === null) throw new Error(`${DEFINITION} is not on the main line of the harness`);
    return instructionsOf(text);
  }

  async ask(workspace: string, question: string): Promise<AskResponse> {
    const ws = await this.workspaces.get(workspace);
    const q = question.trim().replace(/\s+/g, ' ');
    const key = `${workspace}\u0000${q.toLowerCase()}`;
    const now = Date.now();
    const hit = this.kept.get(key);
    if (hit && now - hit.at < KEPT_MS) return hit.answer;
    const answer = this.answer(ws, q);
    this.kept.set(key, { at: now, answer });
    // A failed answer is asked afresh next time; the oldest are forgotten first
    answer.catch(() => this.kept.delete(key));
    for (const k of this.kept.keys()) {
      if (this.kept.size <= KEPT) break;
      this.kept.delete(k);
    }
    return answer;
  }

  private async answer(ws: Workspace, q: string): Promise<AskResponse> {
    const [embedding] = await this.embed([q]);
    const found = (await ws.index.retrieve(q, embedding ?? null, SOURCES, 1)).slice(0, SOURCES + 6);
    if (found.length === 0) {
      return { question: q, answer: 'Nothing in the knowledge graph matches this yet.', sources: [] };
    }
    const docs = await Promise.all(
      found.map(async (s) => {
        const row = await ws.index.row(s.path);
        const refs = (await ws.index.neighbours(s.path)).map((r) =>
          r.direction === 'out' ? `${r.relation} → ${r.path}` : `${r.path} → ${r.relation} this`,
        );
        const card = (row?.card ?? '').slice(0, CARD_CHARS);
        return `## ${s.title}\npath: ${s.path}\ntype: ${s.type}\nreferences: ${refs.join('; ') || 'none'}\n\n${card}`;
      }),
    );
    const prompt = `# Question\n\n${q}\n\n# Entities the search found, best first\n\n${docs.join('\n\n---\n\n')}`;
    const model = sdkModel(setModel(await this.models(), 'search'));
    const text = (
      await ask({
        cwd: ws.path,
        system: await this.instructions(ws),
        prompt,
        model,
        limits: config.limits,
        procgov: config.procgov,
      })
    ).trim();
    // Only what was found can be linked: a path the answer made up reads as plain text
    const known = new Set(found.map((s) => s.path));
    const answer = text.replace(/\[([^\]]+)\]\(\s*<?([^)\s>]+)>?\s*\)/g, (link, label: string, href: string) => {
      const linked = entityLinks(link)[0];
      return linked && !known.has(linked) ? label : link;
    });
    const cited = entityLinks(answer);
    const rank = (s: SearchResult) => {
      const i = cited.indexOf(s.path);
      return i < 0 ? cited.length + found.indexOf(s) : i;
    };
    return { question: q, answer, sources: [...found].sort((a, b) => rank(a) - rank(b)) };
  }
}
