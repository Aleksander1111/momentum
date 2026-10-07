---
type: Frontend/Screen
origin: user
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 1
references: []
artifacts:
  - apps/app/src/app/(tabs)/timeline.tsx
kind: page
---
# Timeline screen

What happened in the harness, newest first, grouped by day:

- The user's actions: sign-ins, reactions, chats, settings, projects on and off
- One event per run once it lands or ends
- What the harness did on its own, such as switching off a project
- Beside each title only how it moved the entity state counts, an icon and ±n each
- Filtered by project, and by actor: all, you, runs, harness
- Beside the actors, one choice with them, a pill Queued n, Running m: running, then queued runs, time, why queued, model, risk; a run opens on a press
- The newest page and runs under way polled every 4 s; Show older fetches older pages once
- An entity an event names opens on a press
