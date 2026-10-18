import { AutomationName, TriggerFields } from '@momentum/contract';
import { parseEntity } from '@momentum/entity';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { DEFINITION_TYPE, RISK_RULES, STEPS, TRIGGER_TYPE } from '../src/automations.ts';

const REPO = join(import.meta.dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(REPO, path), 'utf8');
/** Automations with no trigger entity: summarization runs from the Stop hook, graph build while the project is enabled, search in one turn */
const UNTRIGGERED: AutomationName[] = [...STEPS, 'graph-build', 'search'];

/**
 * The automation definitions as this repository ships them: what the harness materializes into every project. A
 * broken one would reach every project as it lands, so they are checked here, with no server and no database.
 */
describe('the automation definitions', () => {
  it('are one directory per automation, each a known one', () => {
    const dirs = readdirSync(join(REPO, 'automations'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    expect(dirs).toEqual([...AutomationName.options].sort());
  });

  for (const name of AutomationName.options) {
    describe(name, () => {
      const agent = `automations/${name}/agents/momentum-${name}.md`;

      it('has its entity in the harness knowledge graph, over its files', () => {
        const entity = parseEntity(read(`knowledge-graph/Harness/Automation/${name}.md`));
        expect(entity.frontmatter.type).toBe(DEFINITION_TYPE);
        expect(entity.title.trim()).not.toBe('');
        expect(entity.frontmatter.artifacts).toContain(agent);
        for (const artifact of entity.frontmatter.artifacts) {
          expect(artifact.startsWith(`automations/${name}/`), `${artifact} is a file of ${name}`).toBe(true);
          expect(existsSync(join(REPO, artifact)), `${artifact} exists`).toBe(true);
        }
      });

      it('has an agent file Claude Code accepts: its name, a description and a prompt', () => {
        const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(read(agent));
        expect(m, `${agent} starts with frontmatter`).not.toBeNull();
        const fm = parseYaml(m![1]!) as { name?: string; description?: string };
        expect(fm.name).toBe(`momentum-${name}`);
        expect(typeof fm.description === 'string' && fm.description.trim() !== '', 'a description').toBe(true);
        expect(m![2]!.trim(), 'a prompt').not.toBe('');
      });

      it(UNTRIGGERED.includes(name) ? 'has no default trigger' : 'has a default trigger for itself, with valid fields', () => {
        const path = `automations/${name}/trigger.md`;
        if (UNTRIGGERED.includes(name)) {
          expect(existsSync(join(REPO, path))).toBe(false);
          return;
        }
        const trigger = parseEntity(read(path));
        expect(trigger.frontmatter.type).toBe(TRIGGER_TYPE);
        expect(trigger.frontmatter.automation).toBe(name);
        const fields = TriggerFields.safeParse(trigger.frontmatter);
        expect(fields.success, JSON.stringify(fields.error?.issues)).toBe(true);
      });
    });
  }

  it('keep the risk rules among the implementation artifacts, where the harness reads them', () => {
    const entity = parseEntity(read('knowledge-graph/Harness/Automation/implementation.md'));
    expect(entity.frontmatter.artifacts).toContain(RISK_RULES);
    expect(read(RISK_RULES).trim()).not.toBe('');
  });
});
