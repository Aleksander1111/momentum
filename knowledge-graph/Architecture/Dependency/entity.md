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
  - packages/entity/package.json
  - packages/entity/tsconfig.json
  - packages/entity/src/parse.ts
  - packages/entity/src/validate.ts
  - packages/entity/src/card.ts
  - packages/entity/src/plantuml.ts
  - packages/entity/src/types.ts
  - packages/entity/src/diff.ts
  - packages/entity/src/diagram-elements.ts
  - packages/entity/src/links.ts
  - packages/entity/src/index.ts
kind: internal library
---
# entity package

`@momentum/entity`, internal library: how an entity file is read, checked and rendered.

- Parser and serializer: YAML frontmatter, `# title`, the rest is the card; file path to entity path, type path = first two segments
- Validator: known type, type matches the directory, references resolve on the branch, card links among the references, no mermaid; `out_of_scope` names a file the guard put back. The card limit is the run's to keep, never a validation failure
- Card builder: markdown AST (remark, GFM) to blocks; plantuml rendered to SVG by the local PlantUML server, pickable per shape, a diff card's before diagrams too
- Entity types loaded from `docs/entity-types.tsv`
