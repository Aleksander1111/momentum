---
type: Infrastructure/CiCdPipeline
origin: user
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 2
unlocks: 3
references:
  - to: Testing/TestSuite/unit-tests
    relation: runs
  - to: Infrastructure/Environment/dedicated-machine
    relation: complements
artifacts:
  - .github/workflows/ci.yml
---
# GitHub Actions

The checks every change to `main` passes on Linux, on every push and pull request: `ubuntu-latest`, Node 24, pnpm from `packageManager`.

- `pnpm typecheck` and `pnpm test`, the definition validation included
- Postgres: the `pgvector/pgvector:pg17` service container; the embedding model cached between runs
- Not in CI: the back end, the runs and the end-to-end scenarios, which need Windows ([dedicated machine](Infrastructure/Environment/dedicated-machine))
