---
type: Harness/Automation
origin: user
verification: unverified
sync: synced
product_impact: 0
timeline_impact: 0
unlocks: 0
references:
  - to: Harness/Automation/summarization
    relation: hands_off_to
  - to: Harness/Automation/implementation
    relation: feeds
artifacts:
  - automations/preparation/agents/momentum-preparation.md
  - automations/preparation/trigger.md
---
# Preparation

Finds action points that can be started now and plans them; implements nothing.

- **Finds:** verified tasks, features, bugs, issues and research whose dependencies are met and that have no plan yet (references checked both ways)
- **Writes:** plans/<name>.md per action point worth preparing: the action point's entity path, dependencies, what will be done, steps, what it touches, how it will be validated; no length limit
- **Hands off:** writes no entities; on stop, the Stop hook passes plan files to summarization, which makes a Harness/Plan entity per plan for the user to accept
- **Next:** an approved plan goes to implementation
