import { EntityFrontmatter } from '@momentum/contract';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export const KNOWLEDGE_GRAPH = 'knowledge-graph';

export interface ParsedEntity {
  frontmatter: EntityFrontmatter;
  title: string;
  /** The card: everything after the title heading */
  body: string;
}

export class EntityParseError extends Error {}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const TITLE = /^\s*#\s+(.+?)\s*#*\s*(\r?\n|$)/;

export function parseEntity(text: string): ParsedEntity {
  const fm = FRONTMATTER.exec(text);
  if (!fm) throw new EntityParseError('missing frontmatter');
  let data: unknown;
  try {
    data = parseYaml(fm[1] ?? '') ?? {};
  } catch (e) {
    throw new EntityParseError(`frontmatter is not valid YAML: ${(e as Error).message}`);
  }
  const result = EntityFrontmatter.safeParse(data);
  if (!result.success) {
    throw new EntityParseError(
      `frontmatter: ${result.error.issues.map((i) => `${i.path.join('.') || '(root)'} ${i.message}`).join('; ')}`,
    );
  }
  const rest = text.slice(fm[0].length);
  const title = TITLE.exec(rest);
  if (!title) throw new EntityParseError('missing title: the body starts with a "# " heading');
  return {
    frontmatter: result.data,
    title: title[1]!,
    body: rest.slice(title[0].length).replace(/^\s*\n/, '').trimEnd(),
  };
}

export function serializeEntity(entity: ParsedEntity): string {
  const fm = stringifyYaml(entity.frontmatter, { lineWidth: 0 }).trimEnd();
  return `---\n${fm}\n---\n# ${entity.title}\n\n${entity.body.trim()}\n`;
}

/** Entity path from a repository-relative file, e.g. knowledge-graph/Product/Feature/x.md → Product/Feature/x */
export function entityPathOf(repoRelativeFile: string): string | null {
  const f = repoRelativeFile.replaceAll('\\', '/');
  if (!f.startsWith(`${KNOWLEDGE_GRAPH}/`) || !f.endsWith('.md')) return null;
  return f.slice(KNOWLEDGE_GRAPH.length + 1, -3);
}

export function fileOf(entityPath: string): string {
  return `${KNOWLEDGE_GRAPH}/${entityPath}.md`;
}

/** Type path of an entity path: the first two segments, Domain/Type */
export function typeOfPath(entityPath: string): string {
  return entityPath.split('/').slice(0, 2).join('/');
}
