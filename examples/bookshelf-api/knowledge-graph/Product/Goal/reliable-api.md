---
type: Product/Goal
origin: user
verification: verified
sync: synced
product_impact: 4
timeline_impact: 1
unlocks: 1
references:
  - to: Product/Product/bookshelf
    relation: part_of
  - to: Architecture/Api/books-api
    relation: served_by
artifacts: []
---
# The API rejects invalid input

Success criterion: every request with invalid input answers 400 and stores nothing.

- Invalid input: a body that is not JSON, or a missing or empty title or author
- **Not met yet:** `POST /books` with an empty title answers 201 and stores the book; the validation test for it fails
