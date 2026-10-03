import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addTodo, completeTodo, formatTodo, load, removeTodo, save } from '../src/store.js';

test('addTodo appends a to-do with the next id', () => {
  const todos = addTodo(addTodo([], 'buy milk'), '  call mom  ');
  assert.deepEqual(todos, [
    { id: 1, text: 'buy milk', done: false },
    { id: 2, text: 'call mom', done: false },
  ]);
});

test('addTodo rejects empty text', () => {
  assert.throws(() => addTodo([], '   '), /needs some text/);
});

test('completeTodo marks only the matching to-do as done', () => {
  const todos = completeTodo(addTodo(addTodo([], 'a'), 'b'), 2);
  assert.deepEqual(todos.map((t) => t.done), [false, true]);
});

test('removeTodo drops the to-do and keeps the rest', () => {
  const todos = removeTodo(addTodo(addTodo([], 'a'), 'b'), 1);
  assert.deepEqual(todos, [{ id: 2, text: 'b', done: false }]);
});

test('unknown ids are reported', () => {
  assert.throws(() => completeTodo([], 7), /no to-do with id 7/);
  assert.throws(() => removeTodo([], 7), /no to-do with id 7/);
});

test('formatTodo shows id, checkbox and text', () => {
  assert.equal(formatTodo({ id: 3, text: 'ship it', done: true }), '  3  [x] ship it');
});

test('save and load round-trip through a JSON file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'todo-'));
  try {
    const file = join(dir, 'todo.json');
    assert.deepEqual(load(file), []);
    const todos = addTodo([], 'write tests');
    save(file, todos);
    assert.deepEqual(load(file), todos);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
