---
type: Architecture/Dependency
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 1
references:
  - to: Code/Repository/momentum
    relation: part_of
  - to: Architecture/Dependency/contract
    relation: depends_on
artifacts:
  - packages/entity/src/parse.ts
  - packages/entity/src/validate.ts
  - packages/entity/src/card.ts
  - packages/entity/src/mermaid.ts
  - packages/entity/src/types.ts
kind: internal library
---
# entity package

`@momentum/entity`, internal library: how an entity file is read, checked and rendered.

- Parser and serializer: YAML frontmatter, `# title`, the rest is the card; file path to entity path, type path = its first two segments
- Validator: known type, type matches the directory, card within the character limit (code points), every reference resolves on the branch
- Card builder: markdown AST (remark, GFM) to blocks; mermaid blocks rendered to SVG on the server by mermaid-isomorphic in Edge through Playwright, text labels so mobile can draw them
- Entity types loaded from `docs/entity-types.tsv`
