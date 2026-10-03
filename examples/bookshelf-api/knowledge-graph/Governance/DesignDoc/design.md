---
type: Governance/DesignDoc
origin: user
verification: verified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 1
references:
  - to: Product/Product/bookshelf
    relation: concerns
  - to: Architecture/Api/books-api
    relation: concerns
  - to: Architecture/Component/book-store
    relation: concerns
artifacts:
  - docs/design.md
---
# Bookshelf API design

- **Routes:** `GET /books`, `GET /books/:id`, `POST /books`; input is invalid when the body is not JSON or the title or author is missing or empty
- **Storage:** an in-memory list seeded with five books, one store per server
- **Why in-memory:** one reader and a small library, so no database, no dependencies and instant tests; the store has three methods, so a file or SQLite store later only touches the store
- **Not yet:** search by author or title, editing and deleting books
