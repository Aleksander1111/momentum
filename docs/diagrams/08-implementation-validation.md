# Implementation and validation

Source: [SPEC.md → Automations: Implementation, Validation](../SPEC.md#automations), [Database → entity](../SPEC.md#entity)

```plantuml
rectangle "Verified entity\nsync: entity_ahead" as Target
rectangle "Implementation automation\ntarget_path set; entity sync: updating" as Impl
rectangle "Own checkout of the main line\nqueued behind the project's other automation runs" as Checkout
rectangle "Lands on the main line when the run ends\nresult entity implements the target, unverified" as Land
rectangle "Validation run over the landed work\nreview, test suite run, exploratory pass, or consistency check" as Val
hexagon "Validation passes?" as Pass
rectangle "Nothing to do\nthe result waits in the feed" as Done
rectangle "Issue entity, source validation\nown priority, in the feed" as IssueS
rectangle "Result approved\nresult and target sync: synced" as Approved
rectangle "Background validation loop\nregression and exploratory testing" as Loop
rectangle "Project as it stands" as Project
rectangle "Attention feed" as Feed
rectangle "User approval" as User
Target --> Impl
Impl --> Checkout
Checkout --> Land
Land --> Val : implementation_finished
Val --> Pass
Pass --> Done : yes
Pass --> IssueS : no
IssueS --> Feed
Land --> Feed
Loop --> Project
Loop --> Feed : defects surface
Feed --> User
User --> Approved
```

Nothing is merged and nothing is held: the work is on the main line as soon as the run ends, and what validation finds reaches the user as issues.
