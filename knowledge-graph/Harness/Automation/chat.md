---
type: Harness/Automation
origin: user
verification: verified
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

- Own process and checkout, alongside the automation runs; can do anything they can
- What the user asks for is done in the run, never proposed back for approval: asked to remove, it deletes the files and drops the references; asked to change, it changes
- A send back's comment decides the target: change, split, replace, add alongside, or remove
- A plan asked for goes to plans/<name>.md, which summarization makes a Harness/Plan
- Never turns one chat into a skill, memory or definition change on its own; asked outright, it makes it
- Everything it writes lands unverified; the user verifies the work in the feed
