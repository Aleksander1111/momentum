---
type: Harness/Automation
origin: user
verification: unverified
sync: synced
product_impact: 0
timeline_impact: 0
unlocks: 0
references: []
artifacts:
  - automations/chat/agents/momentum-chat.md
  - automations/chat/trigger.md
---
# Chat

The direct chat: an automation the user starts instead of the schedule.

- Own process and checkout; runs alongside the automation runs
- Answers from the knowledge base first, then the repository, naming entities as links the app opens
- Can do anything the other automations can
- A send back's comment decides the target: change, split, replace, add alongside, or retire with a Harness/Plan
- A plan asked for goes to plans/<name>.md, which summarization makes a Harness/Plan
- Never turns one chat into a skill, memory or definition change on its own
- Results reach the approved state through the feed
