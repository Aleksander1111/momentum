import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { GraphSnapshot, TypeNode } from '@momentum/contract';
import { config } from './config.ts';
import type { Momentum } from './momentum.ts';
import { zip, type ZipEntry } from './zip.ts';

/**
 * One project's knowledge graph to hand to someone without Momentum: the served web app with the graph beside its
 * page, in a zip. Unpacked, `index.html` opens in any browser on any computer, from the file itself: the page's
 * addresses are relative, the app reads the graph from `snapshot.js`, keeps its history in memory and reaches no
 * server.
 */

/** Every entity path in the tree, in its order */
function paths(nodes: TypeNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    paths(n.children, out);
    for (const e of n.entities) out.push(e.path);
  }
  return out;
}

/** The graph as the app shows it: the project, its tree of types and every entity in full */
export async function graphSnapshot(momentum: Momentum, name: string): Promise<GraphSnapshot> {
  const workspace = (await momentum.workspaceList()).find((w) => w.name === name);
  if (!workspace) throw new Error(`No workspace ${name} under ${config.root}`);
  const types = await momentum.types(name);
  const entities = [];
  for (const path of paths(types.types)) entities.push(await momentum.entity(name, path));
  // Shown as included whatever its loops do here: the export has none
  return { exportedAt: new Date().toISOString(), workspace: { ...workspace, enabled: true }, types, entities };
}

/**
 * Opened from a file, the page's address cannot change, so the browser's history lives here: the router's pushes,
 * replacements and steps back land in this list, each step answered with the `popstate` the router waits for. The
 * browser's own Back button leaves the page, as there is nothing of the app in its history.
 */
const fileHistory = `if (location.protocol === 'file:') (() => {
  const h = window.history;
  const entries = [{ state: h.state }];
  let at = 0;
  const show = (state) => Object.defineProperty(h, 'state', { configurable: true, get: () => state });
  h.pushState = (state) => {
    entries.splice(at + 1);
    entries.push({ state });
    at = entries.length - 1;
    show(state);
  };
  h.replaceState = (state) => {
    entries[at] = { state };
    show(state);
  };
  h.go = (n) => {
    const to = at + (n || 0);
    if (!n || to < 0 || to >= entries.length) return;
    at = to;
    show(entries[to].state);
    setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate', { state: entries[to].state })));
  };
  h.back = () => h.go(-1);
  h.forward = () => h.go(1);
  Object.defineProperty(h, 'length', { configurable: true, get: () => entries.length });
})();
`;

/** The graph as a script the page loads before the app: nothing in it can end the script early */
const snapshotScript = (s: GraphSnapshot) =>
  `${fileHistory}globalThis.momentumSnapshot = ${JSON.stringify(s).replace(/</g, '\\u003c')};\n`;

const readme = (name: string, when: string) => `Knowledge graph of ${name}
Exported from Momentum on ${when}.

Open index.html in your browser (a double click does): the Explorer of ${name} opens, from this folder alone.
Nothing is sent anywhere. Keep the files together.
`;

/** The page with every address relative to it, allowed from a file, and the graph loaded before the app */
function pageFromFile(html: string): string {
  const relative = html.replace(/\b(src|href)="\/(?!\/)/g, '$1="./');
  const allowed = relative.replace(/'self'/g, "'self' file:");
  const at = allowed.indexOf('<script');
  if (at < 0) throw new Error('The web app page loads no script');
  return `${allowed.slice(0, at)}<script src="./snapshot.js"></script>\n${allowed.slice(at)}`;
}

/** The served web app's files, its page made to open from a file, with the graph beside them */
async function appFiles(snapshot: GraphSnapshot): Promise<ZipEntry[]> {
  const dist = config.appDist;
  if (!existsSync(join(dist, 'index.html'))) throw new Error(`The web app is not built: no index.html under ${dist}`);
  const entries: ZipEntry[] = [];
  for (const f of await readdir(dist, { recursive: true, withFileTypes: true })) {
    if (!f.isFile()) continue;
    const file = join(f.parentPath, f.name);
    const name = relative(dist, file).split('\\').join('/');
    const data = await readFile(file);
    entries.push({ name, data: name === 'index.html' ? Buffer.from(pageFromFile(data.toString('utf8')), 'utf8') : data });
  }
  entries.push({ name: 'snapshot.js', data: Buffer.from(snapshotScript(snapshot), 'utf8') });
  return entries;
}

/** The zip: the web app, the graph, a note on how to open it */
export async function exportGraph(momentum: Momentum, name: string): Promise<Buffer> {
  const snapshot = await graphSnapshot(momentum, name);
  return zip([...(await appFiles(snapshot)), { name: 'README.txt', data: Buffer.from(readme(name, snapshot.exportedAt.slice(0, 10)), 'utf8') }]);
}
