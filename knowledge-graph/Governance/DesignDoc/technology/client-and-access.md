---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 1
references:
  - to: Governance/DesignDoc/plan/technology
    relation: part_of
artifacts:
  - docs/PLAN.md
---
# Client and access

- **App:** Expo written once for web and mobile; web served statically by the back-end
- **Gestures:** swipe right approves, left disapproves with a comment (gesture-handler + reanimated)
- **Polling:** TanStack Query `refetchInterval`, no sockets
- **Cards:** markdown AST; mermaid rendered to SVG by the guard via Playwright in Edge
- **Auth:** single user, generated or set password; httpOnly cookie on web, SecureStore on mobile; API on the Tailscale interface only
- **Voice tools:** API doubles as MCP server at `/mcp`, plus `run_automation`
- **Mobile:** sideloaded Android APK; iPhone uses the web build as a PWA
