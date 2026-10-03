import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/** Reads the to-do list from a JSON file; a missing file is an empty list */
export function load(file) {
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function save(file, todos) {
  writeFileSync(file, JSON.stringify(todos, null, 2) + '\n');
}

function nextId(todos) {
  return todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;
}

export function addTodo(todos, text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('a to-do needs some text');
  return [...todos, { id: nextId(todos), text: trimmed, done: false }];
}

export function completeTodo(todos, id) {
  if (!todos.some((t) => t.id === id)) throw new Error(`no to-do with id ${id}`);
  return todos.map((t) => (t.id === id ? { ...t, done: true } : t));
}

export function removeTodo(todos, id) {
  if (!todos.some((t) => t.id === id)) throw new Error(`no to-do with id ${id}`);
  return todos.filter((t) => t.id !== id);
}

export function formatTodo(todo) {
  return `${String(todo.id).padStart(3)}  [${todo.done ? 'x' : ' '}] ${todo.text}`;
}
