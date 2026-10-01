# Implementation and validation

Source: [SPEC.md → Automations: Implementation, Validation](../SPEC.md#automations), [Database → entity](../SPEC.md#entity)

```mermaid
flowchart TB
  Target["Verified entity<br/>sync: entity_ahead"]
  Impl["Implementation automation<br/>target_path set; entity sync: updating"]
  Checkout["Own checkout of the main line<br/>queued behind the project's other automation runs"]
  Land["Lands on the main line when the run ends<br/>result entity implements the target, unverified"]
  Val["Validation run over the landed work<br/>review, test suite run, exploratory pass, or consistency check"]
  Pass{"Validation passes?"}
  Done["Nothing to do<br/>the result waits in the feed"]
  IssueS["Issue entity, source validation<br/>own priority, in the feed"]
  Approved["Result approved<br/>result and target sync: synced"]
  Loop["Background validation loop<br/>regression and exploratory testing"]
  Project["Project as it stands"]
  Feed["Attention feed"]
  User(["User approval"])
  Target --> Impl --> Checkout --> Land -->|"implementation_finished"| Val --> Pass
  Pass -->|"yes"| Done
  Pass -->|"no"| IssueS --> Feed
  Land --> Feed
  Loop --> Project
  Loop -->|"defects surface"| Feed
  Feed --> User --> Approved
```

Nothing is merged and nothing is held: the work is on the main line as soon as the run ends, and what validation finds reaches the user as issues.
