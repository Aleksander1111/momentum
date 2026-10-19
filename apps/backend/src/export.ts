import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { GraphSnapshot, TypeNode } from '@momentum/contract';
import { config } from './config.ts';
import type { Momentum } from './momentum.ts';
import { zip, type ZipEntry } from './zip.ts';

/**
 * One project's knowledge graph to hand to someone without Momentum: the served web app with the graph beside its
 * page, in a zip. Unpacked, `open.cmd` (Windows) or `open.sh` (macOS, Linux) serves the folder to the browser on that
 * computer alone and opens the Explorer; the app reads the graph from `snapshot.js` and reaches no server.
 */

/** The ports the folder is served on: the first one free */
const FIRST_PORT = 7301;
const LAST_PORT = 7399;

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

/** The graph as a script the page loads before the app: nothing in it can end the script early */
const snapshotScript = (s: GraphSnapshot) => `globalThis.momentumSnapshot = ${JSON.stringify(s).replace(/</g, '\\u003c')};\n`;

const serveScript = (name: string) => `# Serves this folder to the browser on this computer alone and opens the Explorer; close this window to stop
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$listener = $null
foreach ($p in ${FIRST_PORT}..${LAST_PORT}) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$p/")
  try { $l.Start(); $listener = $l; $port = $p; break } catch { }
}
if (-not $listener) { Write-Host 'No free port between ${FIRST_PORT} and ${LAST_PORT}'; exit 1 }
$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript'; '.css' = 'text/css'; '.json' = 'application/json'; '.map' = 'application/json'; '.png' = 'image/png'; '.ico' = 'image/x-icon'; '.svg' = 'image/svg+xml'; '.woff' = 'font/woff'; '.woff2' = 'font/woff2'; '.ttf' = 'font/ttf'; '.txt' = 'text/plain' }
$url = "http://localhost:$port/explorer?ws=${encodeURIComponent(name)}"
Write-Host "Knowledge graph of ${name}: $url"
Write-Host 'Close this window to stop.'
Start-Process $url
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    # Any page of the app is its one page; nothing outside this folder is served
    if ($path -eq '' -or -not $file.StartsWith($root) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) { $file = Join-Path $root 'index.html' }
    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $ctx.Response.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $ctx.Response.Close()
  } catch { }
}
`;

const servePython = (name: string) => `# Serves this folder to the browser on this computer alone and opens the Explorer; Ctrl+C stops it
import os, webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import quote

ROOT = os.path.dirname(os.path.abspath(__file__))
START, END = ${FIRST_PORT}, ${LAST_PORT}

class Page(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    # Any page of the app is its one page
    def send_head(self):
        if not os.path.isfile(self.translate_path(self.path)):
            self.path = '/index.html'
        return super().send_head()

    def log_message(self, *a):
        pass

for port in range(START, END + 1):
    try:
        server = HTTPServer(('127.0.0.1', port), Page)
        break
    except OSError:
        server = None
if server is None:
    raise SystemExit(f'No free port between {START} and {END}')
url = f'http://localhost:{port}/explorer?ws=' + quote(${JSON.stringify(name)})
print(f'Knowledge graph of ${name}: {url}')
print('Ctrl+C stops.')
webbrowser.open(url)
server.serve_forever()
`;

const openCmd = `@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
`;

const openSh = `#!/bin/sh
cd "$(dirname "$0")" && exec python3 serve.py
`;

const readme = (name: string, when: string) => `Knowledge graph of ${name}
Exported from Momentum on ${when}.

Windows: open open.cmd.  macOS or Linux: run ./open.sh (needs Python 3).
Either serves this folder to your browser on this computer alone and opens the Explorer; nothing is sent anywhere.
Close the window it opened to stop.
`;

/** The served web app's files, with the graph script loaded before the app on its page */
async function appFiles(snapshot: GraphSnapshot): Promise<ZipEntry[]> {
  const dist = config.appDist;
  if (!existsSync(join(dist, 'index.html'))) throw new Error(`The web app is not built: no index.html under ${dist}`);
  const entries: ZipEntry[] = [];
  for (const f of await readdir(dist, { recursive: true, withFileTypes: true })) {
    if (!f.isFile()) continue;
    const file = join(f.parentPath, f.name);
    const name = relative(dist, file).split('\\').join('/');
    const data = await readFile(file);
    entries.push({ name, data: name === 'index.html' ? Buffer.from(withSnapshot(data.toString('utf8')), 'utf8') : data });
  }
  entries.push({ name: 'snapshot.js', data: Buffer.from(snapshotScript(snapshot), 'utf8') });
  return entries;
}

function withSnapshot(html: string): string {
  const at = html.indexOf('<script');
  if (at < 0) throw new Error('The web app page loads no script');
  return `${html.slice(0, at)}<script src="/snapshot.js"></script>\n${html.slice(at)}`;
}

/** The zip: the web app, the graph, the scripts that open it, a note on how */
export async function exportGraph(momentum: Momentum, name: string): Promise<Buffer> {
  const snapshot = await graphSnapshot(momentum, name);
  const when = snapshot.exportedAt.slice(0, 10);
  return zip([
    ...(await appFiles(snapshot)),
    { name: 'serve.ps1', data: Buffer.from(serveScript(name), 'utf8') },
    { name: 'serve.py', data: Buffer.from(servePython(name), 'utf8') },
    { name: 'open.cmd', data: Buffer.from(openCmd, 'utf8') },
    { name: 'open.sh', data: Buffer.from(openSh, 'utf8'), executable: true },
    { name: 'README.txt', data: Buffer.from(readme(name, when), 'utf8') },
  ]);
}
