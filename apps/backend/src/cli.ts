import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { ProjectLogo } from '@momentum/contract';
import { createHttp } from './api/http.ts';
import { createMomentum } from './app.ts';
import { config } from './config.ts';

const [command, ...args] = process.argv.slice(2);
const LOGO_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const m = await createMomentum();

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer;
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
      const name = args[0];
      if (!name) throw new Error(`Usage: momentum ${command} <workspace>`);
      await m.momentum.putSettings({ projects: [{ name, enabled: command === 'enable' }] });
      console.log(`${name} ${command}d.`);
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
      for (const name of args.length ? args : (await m.settings.projects()).map((p) => p.name)) {
        const ws = await m.workspaces.get(name);
        await m.settings.setIndexedCommit(name, '');
        await m.guard.indexMainLine(ws);
        console.log(`${name} indexed.`);
      }
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
      console.log('Commands: generate-password | set-password [password] | enable <workspace> | disable <workspace> | logo <workspace> <file | --remove> | index [workspace...] | openapi');
  }
} finally {
  await m.sql.end();
  process.exit(0);
}
