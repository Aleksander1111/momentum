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
---
# Chat

The direct chat: an automation started by the user instead of by the schedule.

- Own process and checkout, like every automation; runs alongside the automation runs, which go one at a time
- Answers from the knowledge base first, then the repository
- Can do anything the other automations can
- A send back's comment decides the target: change, split, replace, add alongside, or retire (Harness/Plan with `retires`; the files stay until approving the plan removes them)
- A plan the user asks for goes to plans/<name>.md, written as preparation writes one; summarization makes it a Harness/Plan
- Results reach the approved state through the feed
