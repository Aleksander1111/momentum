#!/usr/bin/env node
import { homedir } from 'node:os';
import { join } from 'node:path';
import { addTodo, completeTodo, formatTodo, load, removeTodo, save } from './store.js';

const file = process.env.TODO_FILE ?? join(homedir(), '.todo.json');
const [command, ...args] = process.argv.slice(2);

const usage = `Usage:
  todo add <text>     add a to-do
  todo list           list all to-dos
  todo done <id>      mark a to-do as done
  todo remove <id>    remove a to-do`;

try {
  const todos = load(file);
  switch (command) {
    case 'add': {
      const next = addTodo(todos, args.join(' '));
      save(file, next);
      console.log(`Added: ${formatTodo(next.at(-1))}`);
      break;
    }
    case 'list':
      if (todos.length === 0) console.log('Nothing to do.');
      for (const todo of todos) console.log(formatTodo(todo));
      break;
    case 'done':
      save(file, completeTodo(todos, Number(args[0])));
      console.log(`Done: ${args[0]}`);
      break;
    case 'remove':
      save(file, removeTodo(todos, Number(args[0])));
      console.log(`Removed: ${args[0]}`);
      break;
    default:
      console.log(usage);
      process.exitCode = command ? 1 : 0;
  }
} catch (error) {
  console.error(`todo: ${error.message}`);
  process.exitCode = 1;
}
