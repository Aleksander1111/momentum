import type { ParsedEntity } from './parse.ts';
import { EntityParseError, parseEntity, typeOfPath } from './parse.ts';

export type ValidationCode =
  | 'parse'
  | 'unknown_type'
  | 'type_path_mismatch'
  | 'card_limit'
  | 'unresolved_reference'
  | 'mermaid_diagram';

export interface ValidationIssue {
  path: string;
  code: ValidationCode;
  message: string;
}

export interface ValidationContext {
  characterLimit: number;
  types: { has(type: string): boolean };
  /** Whether an entity path exists on the transaction's branch */
  resolves: (entityPath: string) => boolean;
}

export function cardLength(body: string): number {
  return [...body].length;
}

/** Diagrams are PlantUML: a mermaid code block is not accepted */
const MERMAID = /^ {0,3}(`{3,}|~{3,})\s*mermaid\b/im;

/** Validator rules */
export function validateEntity(path: string, entity: ParsedEntity, ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { frontmatter, body } = entity;
  if (!ctx.types.has(frontmatter.type)) {
    issues.push({ path, code: 'unknown_type', message: `type ${frontmatter.type} is not in entity-types.tsv` });
  }
  if (typeOfPath(path) !== frontmatter.type) {
    issues.push({
      path,
      code: 'type_path_mismatch',
      message: `type ${frontmatter.type} does not match the directory ${typeOfPath(path)}`,
    });
  }
  const length = cardLength(body);
  if (length > ctx.characterLimit) {
    issues.push({
      path,
      code: 'card_limit',
      message: `card is ${length} characters, over the limit of ${ctx.characterLimit}; split it into entities that reference each other`,
    });
  }
  if (MERMAID.test(body)) {
    issues.push({
      path,
      code: 'mermaid_diagram',
      message: 'diagrams are PlantUML, not mermaid; redraw the mermaid block as a ```plantuml code block',
    });
  }
  for (const ref of frontmatter.references) {
    if (!ctx.resolves(ref.to)) {
      issues.push({ path, code: 'unresolved_reference', message: `reference ${ref.relation} → ${ref.to} does not resolve` });
    }
  }
  return issues;
}

export function validateText(
  path: string,
  text: string,
  ctx: ValidationContext,
): { entity: ParsedEntity | null; issues: ValidationIssue[] } {
  try {
    const entity = parseEntity(text);
    return { entity, issues: validateEntity(path, entity, ctx) };
  } catch (e) {
    if (e instanceof EntityParseError) return { entity: null, issues: [{ path, code: 'parse', message: e.message }] };
    throw e;
  }
}
