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

The direct chat: the user asks a question or steers the work without waiting for the feed.

- Answers from the knowledge base first, then the repository
- Can do anything the other automations can, only on its own branch; results reach the approved state through the feed
- Started by a send back from the feed: the comment decides what happens to the target entity — change, split, replace, add alongside, or retire it (a Harness/Plan with `retires`)
- Answers short and plain
