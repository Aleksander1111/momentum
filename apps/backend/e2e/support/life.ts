import type { Env } from './env.ts';
import { entityText, type Entity } from './scripted.ts';

/**
 * The life of the example products: what their knowledge graphs look like once built, and the everyday changes the user
 * makes to them, as the user writes them. Scenarios replay these the way they happen on a working day.
 */

const kg = (path: string) => `knowledge-graph/${path}.md`;
const verified = (e: Entity): string => entityText({ origin: 'automation', verification: 'verified', ...e });

/** todo-cli's knowledge graph as a finished graph build leaves it, approved by the user */
export const TODO_GRAPH: Record<string, string> = {
  [kg('Product/Product/todo-cli')]: verified({
    type: 'Product/Product',
    title: 'todo-cli',
    card: 'A command-line to-do list kept in one JSON file: add, list, complete and remove to-dos.',
    impact: [3, 1, 2],
    artifacts: ['README.md'],
  }),
  [kg('Code/Repository/todo-cli')]: verified({
    type: 'Code/Repository',
    title: 'todo-cli repository',
    card: 'Node 20, no dependencies; `npm test` runs `node --test`. Version 1.0.0.',
    references: [{ to: 'Product/Product/todo-cli', relation: 'part_of' }],
    artifacts: ['package.json'],
  }),
  [kg('Architecture/Component/store')]: verified({
    type: 'Architecture/Component',
    title: 'Store',
    card: 'Loads and saves the to-dos as JSON; `addTodo`, `completeTodo`, `removeTodo` and `formatTodo` work on the list.',
    references: [{ to: 'Product/Product/todo-cli', relation: 'part_of' }],
    artifacts: ['src/store.js'],
  }),
  [kg('Architecture/Component/cli')]: verified({
    type: 'Architecture/Component',
    title: 'Command line',
    card: 'Parses `add`, `list`, `done` and `remove`, reads `TODO_FILE` and calls the store.',
    references: [
      { to: 'Product/Product/todo-cli', relation: 'part_of' },
      { to: 'Architecture/Component/store', relation: 'depends_on' },
    ],
    artifacts: ['src/cli.js'],
  }),
  [kg('Testing/TestSuite/store-tests')]: verified({
    type: 'Testing/TestSuite',
    title: 'Store tests',
    card: 'Cover adding, completing, removing and formatting to-dos.',
    references: [{ to: 'Architecture/Component/store', relation: 'concerns' }],
    artifacts: ['test/store.test.js'],
  }),
};

/** A priority on each to-do: the module the user writes by hand */
export const PRIORITY_JS = `const LEVELS = ['low', 'normal', 'high'];

/** The priority of a to-do, normal unless set */
export function priorityOf(todo) {
  return todo.priority ?? 'normal';
}

export function setPriority(todos, id, priority) {
  if (!LEVELS.includes(priority)) throw new Error(\`priority is one of \${LEVELS.join(', ')}\`);
  return todos.map((t) => (t.id === id ? { ...t, priority } : t));
}

/** High first, then normal, then low; ties keep their order */
export function byPriority(todos) {
  return [...todos].sort((a, b) => LEVELS.indexOf(priorityOf(b)) - LEVELS.indexOf(priorityOf(a)));
}
`;

export const PRIORITY_TEST = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byPriority, setPriority } from '../src/priority.js';

test('high priority comes first', () => {
  const todos = setPriority([{ id: 1, text: 'a' }, { id: 2, text: 'b' }], 2, 'high');
  assert.equal(byPriority(todos)[0].id, 2);
});
`;

/** A due date on each to-do, as an implementation writes it */
export const DUE_JS = `/** Whether a to-do is past its due date (YYYY-MM-DD) on \`today\` */
export function overdue(todo, today = new Date().toISOString().slice(0, 10)) {
  return Boolean(todo.due) && !todo.done && todo.due < today;
}
`;

export const DUE_TEST = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overdue } from '../src/due.js';

test('a to-do past its date is overdue', () => {
  assert.equal(overdue({ due: '2020-01-01', done: false }, '2021-01-01'), true);
});
`;

/** Bookshelf's server as the user splits the routes out of it */
export const BOOK_ROUTES_JS = `/** The /books routes: list, read one, add */
export async function books(req, res, store, { send, readJson }) {
  const { pathname } = new URL(req.url, 'http://localhost');
  const match = pathname.match(/^\\/books\\/(\\d+)$/);
  if (req.method === 'GET' && pathname === '/books') return send(res, 200, store.all());
  if (req.method === 'GET' && match) {
    const book = store.get(Number(match[1]));
    return book ? send(res, 200, book) : send(res, 404, { error: 'book not found' });
  }
  if (req.method === 'POST' && pathname === '/books') {
    const input = await readJson(req);
    if (typeof input.title !== 'string' || typeof input.author !== 'string') return send(res, 400, { error: 'title and author are required' });
    return send(res, 201, store.add(input));
  }
  return false;
}
`;

/** An expenses policy the user adds to the handbook */
export const EXPENSES_MD = `# Expenses

- Book travel through the studio account; anything over 200 EUR needs your lead's approval first.
- Claim other expenses in the HR system within 30 days, with the receipt.
- Meals while travelling: up to 40 EUR a day.
- Home-office purchases fall under the remote work allowance, not expenses.
`;

/** Every entity's artifacts that are not on the main line: what a rename or deletion left pointing nowhere */
export async function missingArtifacts(env: Env, ws: string, sql: Env['sql']): Promise<string[]> {
  const rows = await sql<{ entity_path: string; artifact_path: string }[]>`
    select entity_path, artifact_path from ${sql(`ws_${ws.replace(/[^a-z0-9]/g, '_')}.entity_artifact`)}`;
  const files = new Set(env.files(ws, '.'));
  return rows.filter((r) => !files.has(r.artifact_path)).map((r) => `${r.entity_path} → ${r.artifact_path}`);
}
