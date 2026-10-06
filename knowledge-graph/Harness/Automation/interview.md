---
type: Harness/Automation
origin: requested
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 3
references: []
artifacts:
  - automations/interview/agents/momentum-interview.md
  - automations/interview/trigger.md
---
# Interview

An interview by voice: started by the user saying "interview" and its kind, like a chat.

- One question at a time; each answer written into one document under `interviews/`
- Skip, correct, or question back; "stop interview" or full coverage ends it
- Each answer lands on the main line; the document is summarized into entities once, when it is done
