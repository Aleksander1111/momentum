import { readFileSync } from 'node:fs';

export interface EntityType {
  path: string;
  domain: string;
  name: string;
  description: string;
}

/** Entity types from docs/entity-types.tsv: Domain, Entity Type, Description; the type path is Domain/Entity Type */
export function parseEntityTypes(tsv: string): Map<string, EntityType> {
  const types = new Map<string, EntityType>();
  for (const line of tsv.split(/\r?\n/).slice(1)) {
    const [domain, name, description] = line.split('\t');
    if (!domain || !name || !description) continue;
    const path = `${domain}/${name}`;
    types.set(path, { path, domain, name, description });
  }
  return types;
}

export function loadEntityTypes(file: string): Map<string, EntityType> {
  return parseEntityTypes(readFileSync(file, 'utf8'));
}
