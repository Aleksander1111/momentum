# Deployment and remote access

Source: [SPEC.md → Deployment](../SPEC.md#deployment), [Remote access](../SPEC.md#remote-access), [Orchestrator](../SPEC.md#orchestrator)

```plantuml
left to right direction
rectangle "Front-end — one app" as FrontEnd {
  rectangle "Web" as Web
  rectangle "Mobile" as Mobile
}
rectangle "Private mesh network\nWireGuard, e.g. Tailscale\none key per enrolled device" as Mesh
rectangle "Dedicated machine — self-hosted, no cloud services" as Machine {
  rectangle "One back-end deployable" as Backend {
    rectangle "API\nlistens only on the mesh interface" as API
    rectangle "Orchestrator" as Orch
  }
  rectangle "Run processes\none Claude Code process per run and per project" as Runs
  rectangle "Workspaces root directory" as Root {
    rectangle "Workspace\ngit repository + knowledge base\n+ index and metrics database" as WS
  }
}
Web --> Mesh : polling, per-user session
Mobile --> Mesh : polling, per-user session
Mesh --> API : encrypted tunnel
API --> WS : reads ranking and feed order
Orch --> Runs : starts and supervises
Runs --> WS : own checkout of the main line, landed when the run ends
```
