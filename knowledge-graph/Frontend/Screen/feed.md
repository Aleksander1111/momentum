---
type: Frontend/Screen
origin: requested
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 2
references:
  - to: Harness/Automation/consistency-check
    relation: resolves_issues_of
artifacts:
  - apps/app/src/app/(tabs)/feed.tsx
  - apps/app/src/lib/feed.ts
  - apps/app/src/lib/query.ts
  - apps/app/src/ui/CardView.tsx
  - apps/app/src/ui/StateBadge.tsx
  - apps/app/src/ui/Conversation.tsx
kind: page
---
# Feed screen

Ranked cards of included projects, one on top. Wide: framed, two behind. Phone: frameless, full width until moved.

- Breadcrumb: logo, type, folders; state counters
- Diff since verified: words, marks, diagrams
- Long cards scroll, fading till the end; tables keep width
- Links open; a selection or shape opens its chat with it
- Right approves; left asks rework, commented
- Pulled up at its end, opens its chat below (phone: top rule), files attachable; closed on change/reaction
- Once the chat has messages, card and conversation scroll as one page, composer pinned at the foot
- Issues: severity, concerns, options; right takes the recommended, left another or a reason not to
- Reactions approve/resolve the version; polls 15 s, queues offline
- Top card stays till reacted to; empty: why
