import type { Completeness } from '@momentum/contract';
import { posix } from 'node:path';

/**
 * How complete the knowledge graph is, measured against what a reader needs from it: to understand, manage and develop
 * the product without reading its implementation. Two halves, averaged.
 *
 * Understanding: the questions every product's graph must answer, each a slot filled by an entity of one of its types.
 * Territory: every area of the repository accounted for by some entity. An area is a top-level directory (a directory
 * holding only directories, such as apps/ or packages/, stands for each of its children instead) or the files at the
 * root. Its units are its direct subdirectories and its direct files as one; a unit is claimed when an entity lists it,
 * anything in it, or a directory above it as an artifact, so one entity listing `examples` claims the whole of it.
 * An area weighs the logarithm of its file count: a card is enough for examples/, and a hundred cards over src/ say no
 * more about the area than that it is accounted for, yet a dozen two-file directories must not outweigh the backend.
 *
 * Entities of implementation-detail types claim nothing: a file, class or function card is the detail the graph exists
 * to spare the reader, so it never raises the score.
 */

export const SLOTS: { name: string; types: string[] }[] = [
  { name: 'What the product is', types: ['Product/Product'] },
  { name: 'What it is for', types: ['Product/Goal', 'Product/Initiative', 'Product/RoadmapItem'] },
  { name: 'What it does', types: ['Product/Capability', 'Product/Feature', 'Product/UseCase', 'Product/UserJourney'] },
  { name: 'How it is built', types: ['Architecture/System', 'Architecture/Service'] },
  { name: 'Where the code is', types: ['Code/Repository'] },
  { name: 'Where it runs', types: ['Infrastructure/Environment', 'Infrastructure/Deployment', 'Infrastructure/CiCdPipeline'] },
  { name: 'How it is tested', types: ['Testing/TestSuite', 'Testing/TestPlan', 'Testing/TestCase'] },
  {
    name: 'What rules and decisions shape it',
    types: ['Governance/Decision', 'Governance/Constraint', 'Governance/Requirement', 'Governance/DesignDoc', 'Governance/Policy', 'Product/BusinessRule'],
  },
];

export const DETAIL_TYPES = new Set([
  'Code/SourceFile',
  'Code/Class',
  'Code/Function',
  'Code/Commit',
  'Data/Column',
  'Data/Index',
  'Frontend/FormField',
  'Frontend/LocalizationString',
]);

/** Directories the harness owns inside a repository: never the reader's to understand */
const HARNESS_DIRS = new Set(['knowledge-graph', 'chats', '.claude', '.git']);

export interface Claim {
  artifact: string;
  type: string;
}

/**
 * @param files every file the main line tracks, as git lists it
 * @param claims the artifacts the entities list, each with its entity's type
 * @param types the type of every entity in the graph
 * @param exclude the user's summarization exclusions, glob patterns; what they match is never anyone's to cover
 */
export function measureCompleteness(files: string[], claims: Claim[], types: Iterable<string>, exclude: string[] = []): Completeness {
  const present = new Set(types);
  const slots = SLOTS.map((s) => ({ name: s.name, types: s.types, filled: s.types.some((t) => present.has(t)) }));
  const filled = slots.filter((s) => s.filled).length;
  const understanding = { score: slots.length ? filled / slots.length : 1, slots };

  const excluded = (p: string) => exclude.some((pattern) => posix.matchesGlob(p, pattern));
  const tracked = files.map((f) => f.replaceAll('\\', '/')).filter((f) => !excluded(f) && !HARNESS_DIRS.has(f.split('/')[0]!));
  const artifacts = claims.filter((c) => !DETAIL_TYPES.has(c.type)).map((c) => c.artifact.replaceAll('\\', '/').replace(/\/+$/, ''));
  const isFile = new Set(tracked);
  const above = (a: string, path: string) => a === path || path.startsWith(`${a}/`);
  // A directory unit: an artifact in it, or a directory above it. The files unit of an area: one of its files, or a directory above
  const claimed = (u: Unit) =>
    artifacts.some((a) => (u.kind === 'dir' ? above(a, u.path) || a.startsWith(`${u.path}/`) : above(a, u.area) || (isFile.has(a) && posix.dirname(a) === u.area)));

  const weighted = areasOf(tracked).map((area) => {
    const units = unitsOf(tracked, area);
    const missing = units.filter((u) => !claimed(u)).map((u) => (u.kind === 'dir' ? u.path : `${u.area}/*`));
    const files = area === '.' ? tracked.filter((f) => !f.includes('/')).length : tracked.filter((f) => f.startsWith(`${area}/`)).length;
    return { area: { path: area, score: units.length ? (units.length - missing.length) / units.length : 1, missing }, weight: Math.log2(1 + files) };
  });
  const total = weighted.reduce((s, w) => s + w.weight, 0);
  const territory = { score: total ? weighted.reduce((s, w) => s + w.area.score * w.weight, 0) / total : 1, areas: weighted.map((w) => w.area) };

  const detail = claims.reduce((n, c) => n + (DETAIL_TYPES.has(c.type) ? 1 : 0), 0);
  return { score: (understanding.score + territory.score) / 2, understanding, territory, detail };
}

/** Top-level directories, a grouping directory replaced by its children, and `.` for files at the root */
function areasOf(files: string[]): string[] {
  const out = new Set<string>();
  for (const f of files) {
    const [top, ...rest] = f.split('/');
    if (rest.length === 0) out.add('.');
    else out.add(top!);
  }
  const areas: string[] = [];
  for (const area of [...out].sort()) {
    if (area === '.') {
      areas.push(area);
      continue;
    }
    const inside = files.filter((f) => f.startsWith(`${area}/`)).map((f) => f.slice(area.length + 1));
    const grouping = inside.every((f) => f.includes('/'));
    if (grouping) for (const child of new Set(inside.map((f) => f.split('/')[0]!))) areas.push(`${area}/${child}`);
    else areas.push(area);
  }
  return areas.sort();
}

type Unit = { kind: 'dir'; path: string } | { kind: 'files'; area: string };

/** An area's direct subdirectories, and its direct files as one unit */
function unitsOf(files: string[], area: string): Unit[] {
  const inside = area === '.' ? files.filter((f) => !f.includes('/')) : files.filter((f) => f.startsWith(`${area}/`)).map((f) => f.slice(area.length + 1));
  const dirs = new Set<string>();
  let own = false;
  for (const f of inside) {
    const [first, ...rest] = f.split('/');
    if (rest.length === 0) own = true;
    else dirs.add(area === '.' ? first! : `${area}/${first}`);
  }
  const units: Unit[] = [...dirs].sort().map((path) => ({ kind: 'dir', path }));
  if (own) units.push({ kind: 'files', area });
  return units;
}
