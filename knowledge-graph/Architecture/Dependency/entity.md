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
  - packages/entity/src/plantuml.ts
  - packages/entity/src/types.ts
kind: internal library
---
# entity package

`@momentum/entity`, internal library: how an entity file is read, checked and rendered.

- Parser and serializer: YAML frontmatter, `# title`, the rest is the card; file path to entity path, type path = first two segments
- Validator: known type, type matches the directory, card within the limit (code points), references resolve on the branch, card links among the references; `out_of_scope` names a file the guard put back
- Card builder: markdown AST (remark, GFM) to blocks; plantuml rendered to SVG by the local PlantUML server, pickable shape by shape, a diff card's before diagrams too; mermaid rejected by the validator
- Entity types loaded from `docs/entity-types.tsv`
