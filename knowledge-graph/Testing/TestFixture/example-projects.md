---
type: Testing/TestFixture
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Testing/TestSuite/end-to-end-scenarios
    relation: used_by
  - to: Code/Repository/momentum
    relation: part_of
artifacts:
  - examples
---
# Example projects

Four small projects under `examples/`, copied into each end-to-end scenario's own workspaces root as the projects the harness runs over. Nothing else uses them.

| Project | What it is |
|---|---|
| bookshelf-api | Node HTTP API for a personal library, no dependencies; a knowledge graph already built |
| handbook | A 30-person design studio's team handbook: policies, how-to guides, an archive; a knowledge graph of its decisions and policies |
| notes-api | TypeScript HTTP API for notes with tags, search and markdown export; decision records and a changelog |
| todo-cli | Tiny command-line to-do list kept in a JSON file |
