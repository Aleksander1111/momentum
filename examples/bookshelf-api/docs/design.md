# Bookshelf API design

A small HTTP API for keeping track of the books in a personal library.

## Routes

| Method | Path         | Answer                                      |
| ------ | ------------ | ------------------------------------------- |
| GET    | `/books`     | 200 with every book                         |
| GET    | `/books/:id` | 200 with the book, 404 when there is none   |
| POST   | `/books`     | 201 with the new book, 400 on invalid input |

A book is `{ id, title, author, year }`. The id is assigned by the server.
Input is invalid when the body is not JSON or when the title or author is
missing or empty.

## Storage

Books live in an in-memory list (`src/store.js`), seeded with five books at
start-up. The store is created per server, so tests get a fresh copy.

## Why in-memory

The library is small and has one reader. Keeping the store in memory means no
database, no dependencies and instant tests. The store has three methods
(`all`, `get`, `add`), so swapping it for a file or SQLite store later only
touches `src/store.js`.

## Not yet

- Searching by author or title
- Editing and deleting books
