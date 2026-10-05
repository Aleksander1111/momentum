// PreToolUse hook: all work in this repository happens on main. Any shell command that would create a branch, switch
// to one, or check one out is refused before it runs.
import { execFileSync } from 'node:child_process';

const REASON = 'Branches are forbidden in this repository: all work happens on main.';
const LISTING = new Set(['-l', '--list', '-v', '-vv', '--verbose', '-a', '--all', '-r', '--remotes', '--show-current', '--merged', '--no-merged', '--contains', '--no-contains', '--sort', '--format', '--color', '--no-color', '--column', '--no-column']);

const input = JSON.parse(await new Promise((ok) => {
  let s = '';
  process.stdin.on('data', (c) => (s += c)).on('end', () => ok(s || '{}'));
}));
const command = String(input.tool_input?.command ?? '');
const cwd = input.cwd || process.cwd();

const isBranch = (name) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`], { cwd, stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
};

/** The git subcommand and its arguments in each simple command of the line */
function gitCalls(line) {
  const calls = [];
  for (const part of line.split(/&&|\|\||[;|\n]/)) {
    const tokens = part.trim().match(/"[^"]*"|'[^']*'|\S+/g)?.map((t) => t.replace(/^["']|["']$/g, '')) ?? [];
    const at = tokens.findIndex((t) => /(^|[\\/])git(\.exe)?$/i.test(t));
    if (at < 0) continue;
    // Skip git's own options (-C dir, -c key=value, --no-pager ...) to reach the subcommand
    let i = at + 1;
    while (i < tokens.length && tokens[i].startsWith('-')) i += tokens[i] === '-C' || tokens[i] === '-c' ? 2 : 1;
    calls.push({ sub: tokens[i], args: tokens.slice(i + 1) });
  }
  return calls;
}

function forbidden({ sub, args }) {
  const flags = args.filter((a) => a.startsWith('-'));
  const names = args.filter((a) => !a.startsWith('-'));
  switch (sub) {
    case 'branch':
      if (args.length === 0) return false;
      if (['-d', '-D', '--delete'].includes(args[0])) return false;
      return !args.every((a) => LISTING.has(a.split('=')[0]));
    case 'switch':
      return !(names.length === 1 && names[0] === 'main' && flags.every((f) => f === '-q' || f === '--quiet'));
    case 'checkout': {
      if (flags.some((f) => ['-b', '-B', '--orphan'].includes(f))) return true;
      const dash = args.indexOf('--');
      const refs = (dash < 0 ? args : args.slice(0, dash)).filter((a) => !a.startsWith('-'));
      return refs.some((r) => r !== 'main' && isBranch(r));
    }
    case 'worktree':
      return args[0] === 'add' && flags.some((f) => ['-b', '-B'].includes(f));
    default:
      return false;
  }
}

if (gitCalls(command).some(forbidden)) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: REASON } }));
}
