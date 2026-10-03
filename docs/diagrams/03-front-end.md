# Front-end

Source: [SPEC.md → Front-end](../SPEC.md#front-end), [API](../SPEC.md#api)

```plantuml
left to right direction
rectangle "User" as User
rectangle "One app — web and mobile" as App {
  rectangle "Attention feed" as Feed
  rectangle "Chat tool" as Chat
  rectangle "Entity layer exploration" as Explore
}
rectangle "API" as API
rectangle "Entities" as Entities
rectangle "Agent" as Agent
rectangle "Runs" as Runs
User --> Feed
User --> Chat
User --> Explore
Feed --> API : polls for new feed items
Chat --> Runs : asks a question, steers a run directly
Chat --> API : polls for results of long-running runs
Explore --> Entities : browse, search
Explore --> Agent : explore through
Agent --> Entities
```
