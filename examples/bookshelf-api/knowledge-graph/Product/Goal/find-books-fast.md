---
type: Product/Goal
origin: user
verification: verified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 2
references:
  - to: Product/Product/bookshelf
    relation: part_of
  - to: Architecture/Api/books-api
    relation: served_by
artifacts: []
---
# Readers find a book fast

Success criterion: a reader finds a book by author or by title in one request.

- **Not met yet:** the API has no search; a reader lists every book or must already know its id
- Measured by the number of requests needed to find a book whose id is unknown, today one full listing
