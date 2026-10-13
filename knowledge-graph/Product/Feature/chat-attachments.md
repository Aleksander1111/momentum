---
type: Product/Feature
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 2
references:
  - to: Frontend/Screen/chat
    relation: concerns
  - to: Harness/Automation/chat
    relation: concerns
  - to: Architecture/Component/runner
    relation: concerns
  - to: Architecture/Api/http-api
    relation: uses
artifacts:
  - apps/backend/src/attachments.ts
  - apps/app/src/lib/attachments.ts
  - apps/app/src/lib/pickFiles.ts
  - apps/app/src/lib/pickFiles.web.ts
  - apps/app/src/ui/Attachments.tsx
---
# Chat attachments

Files attached to a chat message reach the agent as paths on the PC.

- The paperclip picks any files (native: photos); on the web, files pasted into the field or dropped on the composer join them
- Chips wait in the project's composer: thumbnail, size, Uploading… or why refused; × removes; send waits for the upload
- Each uploads at once as a base64 data URL: up to 10 a message, 10 MB each, none empty
- Kept at `<attachments>\<workspace>\<id>\<name>`, outside the project, named Windows-safe, typed by extension; reset drops them
- [The runner](Architecture/Component/runner)'s prompt lists each path, type and size ahead of the message
- Bubbles show them, images inline; opened sandboxed
