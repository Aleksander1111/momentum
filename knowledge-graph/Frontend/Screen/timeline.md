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
- One event per chat or interview, yours: named as the chat, for the latest thing done in it (started, written to, stopped, failed), with all it landed and its state moves summed
- One event per steered run for its writes: the latest
- One event per run once it lands or ends
- What the harness did on its own, e.g. switching off a project, or a project's prompt override as it landed, with its commit message
- Beside each title how it moved entity state counts, an icon and ±n each
- Filtered by project and by actor: all, you, runs, harness
- A pill Queued n, Running m beside the actors: running, then queued runs, time, why queued, model, risk; a run opens on a press
- Newest page and runs under way polled every 4 s; Show older pages back
- An entity an event names opens on a press
