---
type: Architecture/Component
origin: user
verification: verified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 1
references:
  - to: Product/Product/bookshelf
    relation: part_of
artifacts:
  - src/store.js
---
# Book store

An in-memory list of books, created per server by `createStore()` and seeded with five books.

- A book is `{ id, title, author, year }`; ids are assigned in order
- `all()` returns every book, `get(id)` one book, `add(book)` appends one
- Nothing is persisted: the list resets on restart
