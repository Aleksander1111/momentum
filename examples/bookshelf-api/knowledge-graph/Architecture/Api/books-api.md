---
type: Architecture/Api
origin: user
verification: verified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 2
references:
  - to: Architecture/Component/book-store
    relation: depends_on
  - to: Product/Product/bookshelf
    relation: part_of
  - to: Governance/DesignDoc/design
    relation: implements
artifacts:
  - src/server.js
---
# Books API

JSON over `node:http`; `createApp(store)` builds the server, so tests start it on a free port with a fresh store.

| Method | Path | Answer |
| --- | --- | --- |
| GET | `/books` | 200 with every book |
| GET | `/books/:id` | 200 with the book, 404 when missing |
| POST | `/books` | 201 with the new book; 400 when the body is not JSON or the title or author is not a string |

An empty title still passes the check.
