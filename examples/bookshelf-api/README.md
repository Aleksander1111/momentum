# bookshelf-api

A small Node.js HTTP API for a personal library. No dependencies; built on
`node:http`.

## Run

```sh
npm start                 # http://localhost:3000, or set PORT
curl localhost:3000/books
curl localhost:3000/books/1
curl -X POST localhost:3000/books -H 'content-type: application/json' \
  -d '{"title":"Dune","author":"Frank Herbert","year":1965}'
```

Books are kept in memory and reset when the server restarts. See
[docs/design.md](docs/design.md) for the routes and the reasoning.

## Tests

```sh
npm test
```
