# Working in this repository

- All work happens on `main`. Never create, check out or switch to another branch, and never use a worktree on a branch.
- Commit straight to `main`, one change after another. This overrides any default to branch before committing.
- Momentum itself works on one straight line: no branches, no merges, in this repository and in the projects it runs.

# Verifying UI

- The user runs everything in Firefox. Verify every UI change in Firefox: Playwright `firefox.launch({ channel: 'moz-firefox' })`, as the e2e runner does. Never use the built-in Chromium browser pane or Chrome to check how something looks or behaves.
