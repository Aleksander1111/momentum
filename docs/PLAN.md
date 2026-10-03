# Momentum implementation plan

Source: [SPEC.md](SPEC.md), [entity-types.tsv](entity-types.tsv), [diagrams](diagrams/), [designs](designs/pages.html)

The infrastructure is built in one pass. Work packages below are ordered by dependency, not delivered as slices.

## Technology decisions

| Area | Decision | Driven by |
|---|---|---|
| Language | TypeScript everywhere, Node 24 LTS, pnpm workspaces monorepo | Claude Code and the Claude Agent SDK are Node; one language across front-end, API, orchestrator, guard and automations |
| Front-end | Expo (React Native) with Expo Router; web target through react-native-web, served as static files by the back-end | One app, written once, deployed to web and mobile |
| Gestures | react-native-gesture-handler + react-native-reanimated | Swipe right to approve, swipe left to disapprove with a comment |
| Polling | TanStack Query with `refetchInterval`; no sockets | Front-end polls for feed items and run results; no persistent push channel |
| Markdown and diagrams | Cards rendered from markdown AST; PlantUML diagrams rendered to SVG on the server by the guard (the PlantUML server in Docker on this machine, `plantuml/plantuml-server:jetty` on port 8080; labels as SVG text), shown with react-native-svg on mobile and as an image on web; mermaid is not accepted | A card may carry a diagram; no WebView on mobile |
| Back-end | Fastify + zod, one process: API, orchestrator, consistency guard | One back-end deployable, only runs as separate processes |
| Runs | Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), one subprocess per run, cwd = the run's checkout | Claude Code as a first-class citizen; one Claude Code process per run and per project |
| Run isolation | A detached `git worktree` per run under `C:\Projects\.runs\<workspace>\<run-id>` at the tip of the main line, no branch; the process is placed in a Windows job object with CPU and memory limits by procgov as soon as it starts, so everything it starts inherits the job; killed with its process tree | Own checkout, isolated, killable, own resource limits; everything on one branch |
| Landing | When a run ends, the harness commits its checkout and lands the commit on the main line: fast-forwarded when the main line has not moved, replayed onto the new tip as one commit otherwise (`git merge-tree`), so the history stays one line; a conflicting file takes the run's side and the conflicts are raised as a Harness/Conflict in the same commit; the user's checkout is updated where its files were clean | Everything on one branch; conflicts resolved by queueing, the rest raised |
| Scheduling | Automation runs (schedule and event triggers) go one at a time per project, queued oldest first; runs the user starts (on demand: chat, send back, an automation on demand) start at once; one total across projects | Conflicts resolved by queueing; the user never waits behind a loop |
| Knowledge base files | Markdown at `knowledge-graph/<type path>/<name>.md` on the workspace main line; frontmatter carries type, references and ranking parameters; body is the card, free-form markdown within the configured character limit | Card limit and on-disk layout fixed by the spec |
| Parser and validator | unified: remark-parse, remark-gfm, remark-frontmatter; validator enforces the configured character limit and resolves references | Validation covers the card limit and the references between entities |
| Index and metrics database | Postgres 18 in Docker on this machine (`pgvector/pgvector:pg18-trixie`), database `momentum`, one schema per workspace (`ws_<workspace>`); postgres.js driver; `tsvector` + GIN for search, pgvector for embeddings | One self-hosted store per workspace, not a managed service |
| Graph RAG retrieval | `ts_rank` full text + pgvector cosine + reference traversal over `entity_reference` (recursive CTE); embeddings computed in-process with `@huggingface/transformers` (bge-small, ONNX) | Graph RAG over entity types; no cloud service beyond the Anthropic API |
| KB access for runs | An in-process MCP server `momentum-kb` (search, read, references, write, record_agent_metric) given to every run by the SDK, and `momentum-run` (report_graph_build) for the graph build | Agents and automations read and write the knowledge base freely in their own checkout |
| Consistency guard | Claude Code hooks in every run: PostToolUse validates each knowledge-base write as it happens, Stop sends the run back to fix changes the guard would not accept; chokidar watch on `knowledge-graph/` of every run checkout for changes made outside the tools; a transaction is the set of changes of one run, landed on the main line as one commit; the index follows the main line: every entity that changed since the last indexed commit is indexed, an unverified one stands in the feed, a verified one leaves it | Reacts to every change, groups related changes, updates the index |
| Attention ranking | `product_impact`, `timeline_impact`, `unlocks` are integers 0–5 in entity frontmatter, written by the automation or user that authored the entity; `rank` = product_impact + timeline_impact + unlocks, a generated column computed when the index is updated; ties go to the item that entered the feed first | Ranking derived from the entities themselves; API reads the feed order with no work per poll |
| Cross-project feed | API merges the per-workspace `attention_ranking` tables of enabled projects by rank at request time, one `UNION ALL` across their schemas; a second union over their `entity` tables counts entities by verification and sync state for the feed counters | One feed across projects, adjusting to the enabled set |
| Harness settings | Schema `harness` in the same Postgres database: enabled projects and the state of their knowledge graph build, feed size, lifetime rules, card configuration (character limit, presentation rules), path patterns never summarized, concurrency, models, sessions, the workspace of every run id, usage readings | Enabling a project must not create commits in it |
| Authentication | Single user; password generated at install into `C:\Projects\.momentum\password.txt` (`pnpm momentum generate-password`), or chosen with `pnpm momentum set-password`; session token in an httpOnly cookie on web and SecureStore on mobile, as a bearer token for MCP; API listens only on the Tailscale interface, `MOMENTUM_HOST` overrides it for local testing | Per-user session on top of the mesh; no port on the public internet |
| Voice tools | The API doubles as an MCP server (streamable HTTP, `/mcp`, behind the same session) over the same handlers, plus `run_automation` for automations whose trigger allows starting on demand | Every capability reachable without the UI |
| Machine | This machine: Windows 11, workspaces root `C:\Projects`; back-end served at every logon by the `Momentum` scheduled task (`apps/backend/service/install.ps1` registers it; `serve.ps1` waits for Postgres and runs `pnpm dev` hidden under the user's account for its Claude Code login and git identity, restarting on every change on main), Tailscale for Windows, Claude Code CLI, Node 24 from the Node.js installer, procgov from winget | Self-hosted on the dedicated machine as it is |
| Mobile distribution | Android APK built locally with the Android SDK and sideloaded; iPhone runs the web build installed as a PWA, since iOS cannot be built on Windows | No cloud build service |
| Testing | Vitest for parser, guard, hooks, ranking and orchestrator, against a separate `momentum_test` database; Playwright for the web app; end-to-end runs on a throwaway copy of the harness repository and database | The harness manages itself |

Assumed, not verified: procgov limits hold for the Claude Code subprocess tree.

## Repository layout

```
momentum/
  apps/
    app/                Expo app: web + iOS + Android
    backend/            Fastify API, orchestrator, guard, MCP surface; service/ holds the scheduled task that serves it
  packages/
    contract/           zod schemas and types shared by app and backend; generated openapi.json
    entity/             markdown parser, validator, PlantUML renderer
    kb/                 Postgres index, full text, pgvector, retrieval
    runs/               Agent SDK wrapper, worktrees, landing on the main line, job objects
  automations/          Artifacts of the definition entities: agents, skills, MCP config, one directory per automation
  knowledge-graph/      The harness's own knowledge base; Harness/Automation/ holds the definition entities
  docs/
    designs/            page designs
    diagrams/
    SPEC.md
    PLAN.md
```

A definition entity at `knowledge-graph/Harness/Automation/<name>.md` has its Claude Code files in `automations/<name>/` as artifacts; on approval of the entity they are materialized into every workspace that uses it, under `<workspace>\.claude\`, kept out of git by `.git\info\exclude`. `automations/<name>/trigger.md` is the automation's default trigger entity.

Every run gets its automation's agent file as instructions and the summarization definition as a sub-agent. When the run stops by itself, its Stop hook blocks once and hands it the artifacts it added, changed or deleted outside `knowledge-graph/` (a chat's transcript included) and the documents a graph build run listed, minus the path patterns the user excludes, for the summarization sub-agent. A hook, not a trigger: triggered loops pause at the feed limit.

## Entity file format

````markdown
---
type: Product/Feature
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/Decision/remote-access/private-mesh
    relation: depends_on
artifacts:
  - chats/2026-09-30-remote-access.jsonl
---
# Remote access over a private mesh

No port is exposed to the public internet; clients reach the machine through a WireGuard mesh.

- API listens only on the mesh
- One key per enrolled device

| Layer | Protection |
|---|---|
| Tunnel | End-to-end encryption |

```plantuml
rectangle Client
rectangle Mesh
rectangle API
Client -> Mesh
Mesh -> API
```
````

Validator rules: the card body is within the configured character limit; `type` is a path from entity-types.tsv and matches the entity's directory; every `references.to` resolves in the run's checkout; diagrams are `plantuml` code blocks, and a `mermaid` code block is rejected.

Frontmatter beyond the fields above:

| Entity type | Fields |
|---|---|
| Harness/Trigger | `automation`, `schedule` (cron), `events` (`entity_ahead`, `implementation_finished`), `on_demand` |
| Harness/Issue | `source`: guard, consistency_check or validation; `category` on consistency_check issues: reference, card-limit, type-path, contradiction, repetition, ambiguity, design-gap, logical, naming, struct, verbose, split; `severity` on content categories: high, medium or low; `options` (label, change) and an optional `recommended` index on consistency_check issues; `wont_resolve`, the user's reason, on an issue closed without a change; an open contradiction issue counts on every entity it concerns as its `contradictions` |
| Harness/Conflict | `source`: guard; `artifacts`: the files outside the knowledge graph that conflicted; `concerns` references to the entities that conflicted or stand over the artifacts |
| Harness/Automation | `variant`, when competing implementations are compared |

Relations the harness acts on: `implements` (sync), `retires` (retention), `concerns` (issues).

## Work packages

| # | Package | Depends on | Delivers |
|---|---|---|---|
| 0 | Machine | — | Tailscale, Node, Claude Code CLI, procgov, Momentum scheduled task, `C:\Projects` as the workspaces root, this repository as the first workspace |
| 1 | Contract | — | zod schemas for entity, feed item, run, chat, metrics, settings; generated OpenAPI |
| 2 | Entity package | 1 | Parser, validator, PlantUML renderer, golden fixtures |
| 3 | KB package | 2 | Schema of the tables from SPEC.md per workspace (see Database below), full text, pgvector, embeddings, retrieval, `momentum-kb` MCP server |
| 4 | Runs package | 0 | Worktree lifecycle, Agent SDK session per run, job object limits, kill, usage capture from the SDK as a share of the 5-hour and weekly limits |
| 5 | Consistency guard | 2, 3, 4 | Hooks and watcher per run, transaction grouping, validation, issue entities, sync state, index update, ranking |
| 6 | Orchestrator | 4, 5 | Loops per enabled project, schedule, event and on-demand triggers read from each workspace's trigger entities, feed-size bound, concurrency semaphore, chat runs |
| 7 | API | 1, 3, 6 | Session, feed, approve, send back, resolve, won't resolve, entities, search, chats, runs, metrics, settings; MCP surface over the same handlers |
| 8 | Automations | 3, 4 | Ten definition entities in `knowledge-graph/Harness/Automation/` with artifacts in `automations/`: exploration, preparation, consistency check, retention, implementation, validation, optimization, summarization, chat, graph build; a default trigger entity for each of the eight automations that start by schedule, event or on demand (summarization runs from the Stop hook, the graph build starts with enabling, so they have none), committed unverified to the main line when a workspace is enabled, so they wait in the feed; materialization on approval |
| 9 | App | 1, 7 | Seven pages below, web and mobile |
| 10 | Metrics | 3, 5, 7 | Attention, understanding, agents, implementation metrics; usage as percentage points of the rolling 5-hour and weekly limits; attention patterns |
| 11 | End-to-end validation | all | The harness repository runs as a workspace on the machine: loops produce feed items, approval lands on the main line, metrics fill |

## Approval, send back and issue resolution

- Two independent states per entity: `verification` (unverified, verified) is the user's judgement; `sync` (synced, entity_ahead, artifact_ahead, updating) is the entity against its artifact or implementation.
- Approve: the entity already stands on the main line; one commit sets `verification: verified` in its file, removes the entities it `retires` and sets the entities it `implements` to `synced`. The commit is made without a working tree; in the checkout that has the main line, only files that were clean are updated. An `attention_metric` row is recorded. An implementable entity (Product/Feature, FeatureRequest, UserStory, DevTask, Bug, TechDebt, Harness/Plan) with no `implements` reference becomes `entity_ahead`: approved, awaiting implementation. A plan is such an entity and nothing more: approved and ahead of its artifacts.
- Send back: the comment starts a chat run with the comment as its prompt and the entity as its `target_path`; `sync` is `updating` until that run's transaction lands. What happens to the entity is decided by the comment, not by a state.
- Resolve an issue: an issue with `options` shows them on its feed card, the recommended one picked. Swipe right resolves with the picked option, swipe left with the user's own text: either starts a chat run that applies it to the entities the issue `concerns` and retires the issue. A picked option is recorded as approved, the user's own as sent back.
- Won't resolve: one commit sets `verification: verified` and `wont_resolve` to the user's reason; the issue stays in the knowledge graph, so the consistency check does not raise it again, and no longer counts as a contradiction. Recorded as rejected.
- Implementation run: targets an `entity_ahead` entity, which is `updating` while it runs; the approved result carries an `implements` reference and both become `synced`.
- Artifact change: the guard sets `artifact_ahead` and summarization rewrites the card; `verification` is untouched until the rewrite reaches the feed.
- Implementation: the work lands on the main line when the run ends, like every run's; `implementation_finished` starts a validation run over it, and a failed validation raises a Harness/Issue with `source: validation`. Nothing is merged and nothing is held.
- Landing conflict: a file the run changed that changed on the main line while it ran lands on the run's side; the guard writes a Harness/Conflict `<run-id>` in the same commit, concerning the conflicted entities and the entities over the conflicted artifacts.
- Invalid transaction: the guard writes a Harness/Issue `guard-<run-id>` with `source: guard` into the checkout, landed with the changes it lists; the entities it concerns stand in the feed with it.
- Retirement: retention writes a Harness/Plan with `retires` references and deletes the retired files in its checkout; the plan lands and waits in the feed, and approving it removes the retired files from the main line.

## Pages

Designs: [designs/pages.html](designs/pages.html), one PNG per page and device in [designs/](designs/).

| Page | Purpose | Source | API |
|---|---|---|---|
| Session | Establish the per-user session | Remote access | `POST /session`, `DELETE /session` |
| Feed | Ranked cards across enabled projects, with counters of the entities by verification and sync state; swipe right approves, swipe left disapproves with a comment | Attention feed, slide 2 | `GET /feed`, `POST /feed/{path}/approve`, `POST /feed/{path}/send-back` |
| Entity | One entity in full: verification, sync, type path, card, references, artifacts | Knowledge base, database | `GET /workspaces/{ws}/entities/{path}` |
| Explorer | Browse a workspace's entities by type path, including the definition and trigger entities, search them, or explore through an agent | Front-end | `GET /workspaces/{ws}/types`, `GET /workspaces/{ws}/search?q=` |
| Chat | Chats per workspace; a conversation attached to a run; steer the run, ask a question, see what it has used, or stop it | Chat tool, Automations → Chat | `GET /workspaces/{ws}/chats`, `POST /workspaces/{ws}/chats`, `GET /runs/{id}`, `POST /runs/{id}/messages`, `POST /runs/{id}/kill` |
| Metrics | Four metric families over time and usage as percentage points of the rolling 5-hour and weekly limits, per workspace | Index and metrics database | `GET /workspaces/{ws}/metrics` |
| Settings | Included projects, each enabled one with its knowledge graph build (state, runs, entities, usage; stop, resume and reset), feed size, cards (character limit, presentation rules), path patterns never summarized, lifetimes, agents, models (one model for all runs, one per automation, or by risk) | Slide 1, Orchestrator, Automations → Graph build | `GET /settings`, `PUT /settings`, `GET /workspaces/{ws}/graph-build`, `PUT /workspaces/{ws}/graph-build`, `POST /workspaces/{ws}/reset` |

Also served: `GET /workspaces` for the workspace pickers, `/mcp` for voice tools, `/openapi.json`, and the web build for page loads.

Navigation: five tabs on mobile (Feed, Explorer, Chat, Metrics, Settings), a left rail on web. Entity and the chat conversation open from the tab they belong to. No page carries a title; the tab labels it.

Appearance: light and dark palettes in `apps/app/src/ui/theme.ts`. Settings offers System, Light or Dark; the choice is kept on the device, and System follows the device scheme.

## Decisions on open questions

| Question | Decision |
|---|---|
| How a workspace is added or retired | A git repository under `C:\Projects` is a workspace; deleting the directory retires it; Settings only enables or disables |
| Dedicated agents beyond the automations | None; sub-agents are artifacts of the definition entities, proposed by the optimization automation |
| Where user edits of automations land | Definitions are entities at `knowledge-graph/Harness/Automation/<name>` in the harness workspace, with the Claude Code files in `automations/<name>/` as artifacts; triggers are entities at `knowledge-graph/Harness/Trigger/<name>` in each workspace. Edits and proposals land on the main line through the guard and are verified through the feed; the orchestrator reads triggers from each workspace's index; materialization runs on approval of a definition |
| Form of validation per kind of work | Chosen by the validation automation from the change's entity type; the four forms are review, test suite run, exploratory pass, consistency check |
| Sync with sources | Runs read the repository directly; the graph build automation builds the initial graph from the repository when a project is enabled, and the Stop hook has the summarization sub-agent write summaries from the run's artifacts in the run's checkout |
| Claude Code integration surface | Agent SDK for runs, `momentum-kb` MCP for the knowledge base, definitions materialized under `<workspace>\.claude\` on approval |
| Offline mobile | Last polled feed and entities cached by TanStack Query; reactions queue until the mesh is reachable |

## Implementation decisions

| Area | Decision |
|---|---|
| Default triggers | Exploration every two hours; preparation every two hours at half past; validation at 02:00 and on `implementation_finished`; consistency check at 03:00; retention at 04:00; optimization at 05:00; implementation on `entity_ahead`; chat when the user writes; every one also on demand. A trigger counts once approved |
| Artifact change | Starts a summarization run directly: summarization has no trigger entity |
| Chat | A message to a chat whose run has ended resumes the session on a fresh checkout at the same path; the chat is user-started, so it runs alongside the automation runs. The transcript lands as `chats/<run-id>.jsonl` with the run |
| Checkouts | Created at the tip of the main line when the run starts, removed once the run has landed |
| Legacy branches | Branches `momentum/*` and worktrees left by runs from before everything went to the main line are landed on it once at startup, oldest first, the later landing winning a conflict, then deleted |
| Usage per workspace | The sum of its runs' usage, each read from Claude Code before and after the run, over the rolling 5 hours and week |
| Usage per run | The difference between the first reading of the run and the latest, stored on the run as Claude Code reports it, so a build is watched while it runs |
| Graph build | Starts when a project is enabled and has no trigger entity; every run lands on the main line, so the next sees what it wrote; a run is queued only while the feed has room and no graph build run is open, and is told to write at most that many entities; it reports progress, the share of the repository covered (0–1) and completion through `report_graph_build` on the `momentum-run` MCP server, and the next run's prompt carries that progress; time spent is the sum of the runs' durations, and the full build is estimated as time and usage so far divided by the covered share; the state (building, stopped, complete) lives in the harness schema; Stop kills the run in progress and keeps the next from starting, Resume queues it again, disabling the project stops it and enabling it again resumes it; Reset (two taps) stops every run of the workspace, removes its run checkouts, deletes `knowledge-graph/` from the main line in one commit, drops the workspace schema and its run references, clears the indexed commit and build state, then enables the project afresh: default triggers proposed again and the build started from the top; the harness workspace refuses with 409 |
| Models | Set in Settings, for all projects, as Claude model aliases (Default leaves it to Claude Code): one model for every run; one per automation, summarization included; or by risk, where an implementation run's risk (low, medium, high) is estimated just before it starts by a Haiku call applying the user's rules in `automations/implementation/risk.md` (an artifact of the implementation definition, not materialized) to the target entity and its plans, and runs on the model set for that risk, while every other automation keeps its own; without rules or a target it keeps its own too. The model and risk are recorded on the run and kept when its session resumes |
| Understanding | Consistency = share of entities with no card over the limit and no unresolved reference; open issues = Harness/Issue and Harness/Conflict entities |
| Implementation metrics | Outstanding issues = Harness/Issue and Harness/Conflict; bugs = Product/Bug; defects = Harness/Issue raised by validation |
| Attention patterns | The last ten reactions to one entity type all approved, or all rejected; recorded, not applied |

## Database

The tables of SPEC.md, with what the implementation adds:

| Table | Added |
|---|---|
| entity | `card_blocks` (the card as rendered blocks, diagrams as SVG), `frontmatter`, `search` (tsvector), `embedding` (vector 384), `updated_at` |
| run | `status`, `title`, `prompt`, `base_commit`, `session_id`, `resume_prompt`, `error`, `created_at`, `started_at`, `ended_at`, `usage_five_hour`, `usage_week` |
| attention_ranking | `entered_at` |
| attention_metric | `entity_type`; `time_spent` stored as `time_spent_ms` |
| understanding_metric | `open_issues` |
| agent_metric | `automation`; `usage` stored as `usage_five_hour` and `usage_week` |
| transaction | New: run, the landed commit, paths, validated or invalid, issues, conflicted files |
| run_message | New: the conversation of a run |

Still open: how the attention ranking is tuned and measured; scale, latency and usage targets.
