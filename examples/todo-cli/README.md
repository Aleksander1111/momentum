# todo-cli

A tiny command-line to-do list. To-dos are kept in a JSON file, `~/.todo.json`
by default, or the file named by the `TODO_FILE` environment variable.

No dependencies: Node.js 20 or later is all it needs.

## Usage

```sh
npm link            # makes the `todo` command available
todo add Buy milk
todo list
todo done 1
todo remove 1
```

Without linking, run `node src/cli.js <command>`.

## Tests

```sh
npm test
```
