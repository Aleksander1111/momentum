---
type: Product/Product
origin: user
verification: verified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 2
references:
  - to: Architecture/Api/books-api
    relation: consists_of
  - to: Product/Goal/find-books-fast
    relation: guided_by
  - to: Product/Goal/reliable-api
    relation: guided_by
artifacts:
  - README.md
---
# Bookshelf

A small HTTP API for keeping track of the books in a personal library. One reader, no dependencies, built on `node:http`.

- Lists every book, fetches one by id and adds new ones
- Books are kept in memory and reset when the server restarts
- Goals: readers find a book fast; the API rejects invalid input
