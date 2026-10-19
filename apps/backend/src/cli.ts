import { randomBytes } from 'node:crypto';
import { request } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { ProjectLogo } from '@momentum/contract';
import { createHttp } from './api/http.ts';
import { createMomentum } from './app.ts';
import { config } from './config.ts';
import { exportGraph } from './export.ts';

const [command, ...args] = process.argv.slice(2);
const LOGO_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
// The server is the one process that orchestrates: here nothing ticks, starts a run or indexes beside it
const m = await createMomentum({ orchestrate: false });

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer;
}

/**
 * One HTTP request to the server, over node:http: a second fetch in this process leaves a handle closing when the
 * process exits, which Node asserts on under Windows
 */
function http(method: string, url: string, headers: Record<string, string> = {}, body?: string, timeoutMs = 60_000): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers: { ...headers, connection: 'close' }, timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`${method} ${url} timed out`)));
    req.on('error', reject);
    req.end(body);
  });
}

/** The running server, signed in for this one command; null when none answers on this machine */
async function server(): Promise<{ call: (method: string, path: string, body?: unknown) => Promise<void>; done: () => Promise<void> } | null> {
  let base: string;
  try {
    base = `http://${config.host()}:${config.port}`;
  } catch {
    return null;
  }
  const up = await http('GET', `${base}/openapi.json`, {}, undefined, 2000).then((r) => r.status === 200, () => false);
  if (!up) return null;
  const { token } = await m.auth.createSession();
  return {
    call: async (method, path, body) => {
      const res = await http(
        method,
        `${base}${path}`,
        { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body === undefined ? undefined : JSON.stringify(body),
      );
      if (res.status < 200 || res.status >= 300) throw new Error(`The server refused ${method} ${path}: ${res.status} ${res.text}`);
    },
    done: () => m.auth.endSession(token),
  };
}

try {
  switch (command) {
    case 'generate-password': {
      // Written once to a file for the user; never printed
      const password = randomBytes(18).toString('base64url');
      const file = join(config.root, '.momentum', 'password.txt');
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, `${password}\n`, { mode: 0o600 });
      await m.auth.setPassword(password);
      console.log(`Password generated and written to ${file}`);
      break;
    }
    case 'set-password': {
      const password = args[0] ?? (await ask('Password: '));
      if (!password) throw new Error('Empty password');
      await m.auth.setPassword(password);
      console.log('Password set; existing sessions ended.');
      break;
    }
    case 'enable':
    case 'disable': {
      const [name, flag] = args;
      if (!name || (flag && !(command === 'enable' && flag === '--full'))) throw new Error(`Usage: momentum ${command} <workspace>${command === 'enable' ? ' [--full]' : ''}`);
      if (!(await m.settings.projects()).some((p) => p.name === name)) throw new Error(`No workspace ${name} under ${config.root}`);
      const projects = [{ name, enabled: command === 'enable' }];
      // --full: the knowledge graph builds whatever the feed holds; without it, the build is paced by the feed's room
      const mode = flag === '--full' ? 'full' : null;
      const s = await server();
      if (s) {
        try {
          if (mode) await s.call('PUT', `/workspaces/${encodeURIComponent(name)}/graph-build`, { mode });
          await s.call('PUT', '/settings', { projects });
        } finally {
          await s.done();
        }
        console.log(`${name} ${command}d by the running server${mode ? '; its knowledge graph builds in full' : ''}.`);
      } else {
        // No server: the project is set up here and the server takes it from there when it starts
        if (mode) await m.settings.setGraphBuildMode(name, mode);
        await m.momentum.putSettings({ projects });
        console.log(`${name} ${command}d${mode ? ', its knowledge graph to build in full' : ''}; the server starts its work when it runs.`);
      }
      break;
    }
    case 'logo': {
      const [name, file] = args;
      if (!name || !file) throw new Error('Usage: momentum logo <workspace> <image file | --remove>');
      if (file === '--remove') {
        await m.momentum.setProjectLogo(name, null);
        console.log(`${name} logo removed; the app draws one from the name.`);
        break;
      }
      const type = LOGO_TYPES[extname(file).toLowerCase()];
      if (!type) throw new Error('A logo is a .png, .jpg, .webp or .svg file');
      const logo = ProjectLogo.parse(`data:${type};base64,${(await readFile(file)).toString('base64')}`);
      await m.momentum.setProjectLogo(name, logo);
      console.log(`${name} logo set from ${file}.`);
      break;
    }
    case 'index': {
      const s = await server();
      await s?.done();
      for (const name of args.length ? args : (await m.settings.projects()).map((p) => p.name)) {
        const ws = await m.workspaces.get(name);
        await m.settings.setIndexedCommit(name, '');
        // A running server indexes its enabled projects on its next pass, and the others when they are enabled
        if (s) {
          console.log(`${name} is indexed afresh by the running server.`);
          continue;
        }
        await m.guard.indexMainLine(ws);
        console.log(`${name} indexed.`);
      }
      break;
    }
    case 'export-graph': {
      // A project's knowledge graph for someone without Momentum: the web app with the graph beside it, in a zip
      const [name, out] = args;
      if (!name) throw new Error('Usage: momentum export-graph <workspace> [zip file]');
      const file = out ?? join(config.root, '.momentum', 'exports', `${name}-knowledge-graph.zip`);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, await exportGraph(m.momentum, name));
      console.log(`Wrote ${file}: unpacked, its index.html opens the Explorer of ${name} in any browser.`);
      break;
    }
    case 'openapi': {
      const http = await createHttp(m.momentum, m.auth);
      await http.ready();
      const file = join(config.harness, 'packages', 'contract', 'openapi.json');
      await writeFile(file, JSON.stringify(http.swagger(), null, 2) + '\n');
      console.log(`Wrote ${file}`);
      break;
    }
    default:
      console.log('Commands: generate-password | set-password [password] | enable <workspace> [--full] | disable <workspace> | logo <workspace> <file | --remove> | index [workspace...] | export-graph <workspace> [zip file] | openapi');
  }
} catch (e) {
  // Exiting in `finally` would otherwise drop the error unsaid, with a success code
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await m.sql.end();
  process.exit();
}
