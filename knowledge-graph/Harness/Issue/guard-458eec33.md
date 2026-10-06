---
type: Harness/Issue
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 3
unlocks: 3
references: []
artifacts: []
source: guard
---
# Inconsistent changes from the summarization run

The summarization run 458eec33 left changes the guard cannot accept:

- `apps/app/src/app/(tabs)/_layout.tsx`: the summarization automation may not change this in the harness's repository; it was put back, not landed
- `apps/app/src/app/(tabs)/chat/[runId].tsx`: the summarization automation may not change this in the harness's repository; it was put back, not landed
- `apps/app/src/app/(tabs)/explorer/entity.tsx`: the summarization automation may not change this in the harness's repository; it was put back, not landed
- `apps/app/src/ui/parts.tsx`: the summarization automation may not change this in the harness's repository; it was put back, not landed
