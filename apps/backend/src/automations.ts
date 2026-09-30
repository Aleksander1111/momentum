import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { AutomationName, TriggerFields } from '@momentum/contract';
import { parseEntity } from '@momentum/entity';
import { show } from '@momentum/runs';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { NotFound, type Workspace, type Workspaces } from './workspaces.ts';

export const DEFINITION_TYPE = 'Harness/Automation';
export const TRIGGER_TYPE = 'Harness/Trigger';
/** Automations that run as a step inside the others, as sub-agents of every run */
export const STEPS: AutomationName[] = ['summarization', 'card'];

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

  /** Approved definitions on the harness main line */
  async approved(): Promise<{ path: string; name: string; artifacts: string[]; variant: string | null; responsibility: string }[]> {
    const harness = await this.workspaces.harness().catch((e) => {
      if (e instanceof NotFound) return null;
      throw e;
    });
    if (!harness) return [];
    const rows = await harness.index.byType(DEFINITION_TYPE);
    return rows
      .filter((r) => r.verification === 'verified' && r.branch === null)
      .map((r) => ({
        path: r.path,
        name: r.path.split('/').pop()!,
        artifacts: r.frontmatter.artifacts,
        variant: typeof r.frontmatter.variant === 'string' ? r.frontmatter.variant : null,
        responsibility: r.title,
      }));
  }

  /** Writes the approved definitions' artifacts into <workspace>\.claude\, kept out of git by .git/info/exclude */
  async materialize(ws: Workspace): Promise<void> {
    const harness = await this.workspaces.harness();
    for (const def of await this.approved()) {
      for (const artifact of def.artifacts) {
        const prefix = `automations/${def.name}/`;
        if (!artifact.startsWith(prefix) || artifact.endsWith('trigger.md')) continue;
        const content = await show(harness.path, `refs/heads/${harness.main}`, artifact);
        if (content === null) continue;
        const target = join(ws.path, '.claude', artifact.slice(prefix.length));
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, 'utf8');
      }
    }
    const exclude = join(ws.path, '.git', 'info', 'exclude');
    const current = existsSync(exclude) ? await readFile(exclude, 'utf8') : '';
    const missing = EXCLUDES.filter((e) => !current.split(/\r?\n/).includes(e));
    if (missing.length) {
      await mkdir(dirname(exclude), { recursive: true });
      await appendFile(exclude, `${current.endsWith('\n') || !current ? '' : '\n'}${missing.join('\n')}\n`);
    }
    await this.recordAutomations(ws);
  }

  async materializeAll(): Promise<void> {
    for (const ws of await this.workspaces.enabled()) await this.materialize(ws);
  }

  /** The automation table of a workspace: responsibility, definition and trigger */
  private async recordAutomations(ws: Workspace): Promise<void> {
    const triggers = await this.triggers(ws);
    const s = ws.index.sql(`${ws.index.schema}.automation`);
    for (const def of await this.approved()) {
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
    if (!existsSync(file)) throw new Error(`The ${name} definition is not materialized in ${ws.name}; approve Harness/Automation/${name}`);
    const { description, prompt } = agentFile(await readFile(file, 'utf8'));
    const variant = (await this.approved()).find((d) => d.name === name)?.variant ?? null;
    return { name, description, instructions: prompt, variant };
  }

  /** Sub-agents available to every run: the steps */
  async subAgents(ws: Workspace): Promise<Record<string, AgentDefinition>> {
    const agents: Record<string, AgentDefinition> = {};
    for (const name of STEPS) {
      const file = join(ws.path, '.claude', 'agents', `momentum-${name}.md`);
      if (!existsSync(file)) continue;
      const { description, prompt } = agentFile(await readFile(file, 'utf8'));
      agents[`momentum-${name}`] = { description, prompt };
    }
    return agents;
  }

  /** Approved trigger entities of a workspace */
  async triggers(ws: Workspace): Promise<Trigger[]> {
    const rows = await ws.index.byType(TRIGGER_TYPE);
    const out: Trigger[] = [];
    for (const r of rows) {
      if (r.verification !== 'verified' || r.branch !== null) continue;
      const automation = AutomationName.safeParse(r.frontmatter.automation ?? r.path.split('/').pop());
      const fields = TriggerFields.safeParse(r.frontmatter);
      if (automation.success && fields.success) out.push({ ...fields.data, automation: automation.data, path: r.path });
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
