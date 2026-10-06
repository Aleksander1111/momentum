import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { AutomationName, TriggerFields } from '@momentum/contract';
import { parseEntity } from '@momentum/entity';
import { show } from '@momentum/runs';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { config } from './config.ts';
import { NotFound, type Workspace, type Workspaces } from './workspaces.ts';

export const DEFINITION_TYPE = 'Harness/Automation';
export const TRIGGER_TYPE = 'Harness/Trigger';
/** Automations that run as a step inside the others, as sub-agents of every run */
export const STEPS: AutomationName[] = ['summarization'];
/** Automations that run in the harness workspace alone, over every enabled project: they change the definitions */
export const HARNESS_ONLY: AutomationName[] = ['optimization'];
/**
 * What a run may change in the harness's own repository besides the knowledge graph. The harness serves from its main
 * line and restarts on every change that lands there, so code lands only from the runs the user holds: their chats and
 * interviews, and the implementations of what they approved. Every other run writes what its definition says it writes.
 */
export const HARNESS_SCOPE: Record<AutomationName, 'any' | string[]> = {
  chat: 'any',
  interview: 'any',
  implementation: 'any',
  preparation: ['plans/'],
  optimization: ['automations/'],
  exploration: [],
  'consistency-check': [],
  retention: [],
  validation: [],
  summarization: [],
  'graph-build': [],
  search: [],
};
/** The user's rules for the risk of an implementation, an artifact of the implementation definition */
export const RISK_RULES = 'automations/implementation/risk.md';

export interface Definition {
  name: AutomationName;
  description: string;
  instructions: string;
  variant: string | null;
}

export interface Trigger extends TriggerFields {
  automation: AutomationName;
  path: string;
}

const EXCLUDES = ['.claude/agents/momentum-*', '.claude/skills/momentum-*'];

function agentFile(text: string): { description: string; prompt: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { description: '', prompt: text };
  const fm = (parseYaml(m[1] ?? '') ?? {}) as { description?: string };
  return { description: fm.description ?? '', prompt: (m[2] ?? '').trim() };
}

/**
 * Definitions are entities in the harness workspace (Harness/Automation) whose artifacts are the Claude Code files in
 * automations/<name>/; approved definitions are materialized into every workspace under <workspace>\.claude\.
 */
export class Automations {
  constructor(private readonly workspaces: Workspaces) {}

  /**
   * The definitions on the harness main line, as they stand there: verification is the user's review of an entity,
   * never a switch for what the harness loads
   */
  async definitions(): Promise<{ path: string; name: string; artifacts: string[]; variant: string | null; responsibility: string }[]> {
    const harness = await this.workspaces.harness().catch((e) => {
      if (e instanceof NotFound) return null;
      throw e;
    });
    if (!harness) return [];
    const rows = await harness.index.byType(DEFINITION_TYPE);
    return rows.map((r) => ({
      path: r.path,
      name: r.path.split('/').pop()!,
      artifacts: r.frontmatter.artifacts,
      variant: typeof r.frontmatter.variant === 'string' ? r.frontmatter.variant : null,
      responsibility: r.title,
    }));
  }

  /** Writes the definitions' artifacts into <workspace>\.claude\, kept out of git by .git/info/exclude */
  async materialize(ws: Workspace): Promise<void> {
    // Kept out of git before they are written: no git command ever sees them as untracked files
    const exclude = join(ws.path, '.git', 'info', 'exclude');
    const current = existsSync(exclude) ? await readFile(exclude, 'utf8') : '';
    const missing = EXCLUDES.filter((e) => !current.split(/\r?\n/).includes(e));
    if (missing.length) {
      await mkdir(dirname(exclude), { recursive: true });
      await appendFile(exclude, `${current.endsWith('\n') || !current ? '' : '\n'}${missing.join('\n')}\n`);
    }
    const harness = await this.workspaces.harness();
    for (const def of await this.definitions()) {
      for (const artifact of def.artifacts) {
        const prefix = `automations/${def.name}/`;
        if (!artifact.startsWith(prefix) || artifact.endsWith('trigger.md') || artifact === RISK_RULES) continue;
        const content = await show(harness.path, `refs/heads/${harness.main}`, artifact);
        if (content === null) continue;
        const target = join(ws.path, '.claude', artifact.slice(prefix.length));
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, 'utf8');
      }
    }
    await this.removeOrphans(ws);
    await this.recordAutomations(ws);
  }

  /**
   * Agent and skill files a definition once put in the workspace that no definition produces any more: a renamed or
   * retired automation's. They are deleted, so no run or session picks them up.
   */
  private async removeOrphans(ws: Workspace): Promise<void> {
    const harness = await this.workspaces.harness().catch(() => null);
    const definitions = harness ? await harness.index.byType(DEFINITION_TYPE) : [];
    // Nothing indexed yet says nothing about what is an orphan
    if (definitions.length === 0) return;
    const produced = new Set<string>();
    for (const d of definitions) {
      const prefix = `automations/${d.path.split('/').pop()}/`;
      for (const a of d.frontmatter.artifacts) if (a.startsWith(prefix)) produced.add(a.slice(prefix.length));
    }
    const claude = join(ws.path, '.claude');
    for (const kind of ['agents', 'skills']) {
      const entries = await readdir(join(claude, kind), { recursive: true, withFileTypes: true }).catch(() => []);
      for (const e of entries) {
        if (!e.isFile()) continue;
        const rel = posix.join(kind, relative(join(claude, kind), join(e.parentPath, e.name)).split(sep).join('/'));
        if (!rel.split('/')[1]?.startsWith('momentum-') || produced.has(rel)) continue;
        await rm(join(claude, rel), { force: true });
        console.log(`${ws.name}: removed ${rel}, which no definition produces`);
      }
    }
  }

  async materializeAll(): Promise<void> {
    for (const ws of await this.workspaces.enabled()) await this.materialize(ws);
  }

  /** The automation table of a workspace: responsibility, definition and trigger */
  private async recordAutomations(ws: Workspace): Promise<void> {
    const triggers = await this.triggers(ws);
    const s = ws.index.sql(`${ws.index.schema}.automation`);
    for (const def of await this.definitions()) {
      const row = {
        name: def.name,
        responsibility: def.responsibility,
        definition: def.path,
        trigger: triggers.find((t) => t.automation === def.name)?.path ?? null,
      };
      await ws.index.sql`insert into ${s} ${ws.index.sql(row)} on conflict (name) do update set
        responsibility = excluded.responsibility, definition = excluded.definition, trigger = excluded.trigger`;
    }
  }

  async definition(ws: Workspace, name: AutomationName): Promise<Definition> {
    const file = join(ws.path, '.claude', 'agents', `momentum-${name}.md`);
    if (!existsSync(file)) throw new Error(`The ${name} definition is not materialized in ${ws.name}; Harness/Automation/${name} is not on the harness main line`);
    const { description, prompt } = agentFile(await readFile(file, 'utf8'));
    const variant = (await this.definitions()).find((d) => d.name === name)?.variant ?? null;
    return { name, description, instructions: prompt, variant };
  }

  /** The risk rules on the harness main line, once the implementation definition lists them among its artifacts */
  async riskRules(): Promise<string | null> {
    const def = (await this.definitions()).find((d) => d.name === 'implementation');
    if (!def?.artifacts.includes(RISK_RULES)) return null;
    const harness = await this.workspaces.harness();
    const text = await show(harness.path, `refs/heads/${harness.main}`, RISK_RULES);
    return text?.trim() || null;
  }

  /** Sub-agents available to every run: the steps, each on its own model when one is set for it */
  async subAgents(ws: Workspace, model: (step: AutomationName) => string | undefined = () => undefined): Promise<Record<string, AgentDefinition>> {
    const agents: Record<string, AgentDefinition> = {};
    for (const name of STEPS) {
      const file = join(ws.path, '.claude', 'agents', `momentum-${name}.md`);
      if (!existsSync(file)) continue;
      const { description, prompt } = agentFile(await readFile(file, 'utf8'));
      agents[`momentum-${name}`] = { description, prompt, model: model(name) };
    }
    return agents;
  }

  /** Approved trigger entities of a workspace; one of an automation of the harness alone counts in the harness only */
  async triggers(ws: Workspace): Promise<Trigger[]> {
    const rows = await ws.index.byType(TRIGGER_TYPE);
    const out: Trigger[] = [];
    for (const r of rows) {
      if (r.verification !== 'verified') continue;
      const automation = AutomationName.safeParse(r.frontmatter.automation ?? r.path.split('/').pop());
      const fields = TriggerFields.safeParse(r.frontmatter);
      if (!automation.success || !fields.success) continue;
      if (HARNESS_ONLY.includes(automation.data) && ws.name !== config.harnessName) continue;
      out.push({ ...fields.data, automation: automation.data, path: r.path });
    }
    return out;
  }

  /** Default trigger entities, one per automation that has one, from automations/<name>/trigger.md */
  async defaultTriggers(): Promise<{ path: string; text: string }[]> {
    const harness = await this.workspaces.harness();
    const out: { path: string; text: string }[] = [];
    for (const name of AutomationName.options) {
      const text = await show(harness.path, `refs/heads/${harness.main}`, `automations/${name}/trigger.md`);
      if (text === null) continue;
      parseEntity(text);
      out.push({ path: `Harness/Trigger/${name}`, text });
    }
    return out;
  }
}
