---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 1
references:
  - to: Architecture/Service/app
    relation: part_of
  - to: Architecture/Api/http-api
    relation: consumes
artifacts:
  - apps/app/src/app/session.tsx
  - docs/designs/session-web.png
  - docs/designs/session-mobile.png
kind: page
---
# Session screen

Establishes the per-user session on top of the mesh.

- One password field and a Sign in button; a wrong password marks the field and stays on the page, success lands on the Feed
- Web keeps the session in an httpOnly cookie, mobile in SecureStore as a bearer token
- Reached at `/session`: a 401 from any request redirects here, and mobile starts here while it holds no token
