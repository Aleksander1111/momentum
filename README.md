# Momentum

**A self-hosted harness around Claude Code: the single entry point between you and the work around all your projects.**

Every git repository under one root directory is a workspace. For each project you enable, Momentum builds a knowledge graph of short entity cards, runs Claude Code automations that explore, plan, implement, validate and summarize the work, and brings everything that needs your judgement into one ranked feed across projects, on the web or on your phone.

Everything a run writes lands on the main line **unverified** and waits in the feed. Swipe right to approve it, swipe left to send it back with a comment. Only you verify.

## Video

https://github.com/user-attachments/assets/9f1be4c6-2d95-4c91-bca5-03c4b7c9c4e7

🎬 [Watch the walkthrough on YouTube](https://youtu.be/JHQ4OpeXyJo)

## Contents

1. [Harness and products](#harness-and-products)
2. [User actions](#user-actions)
3. [How everything works together](#how-everything-works-together)
4. [Entities](#entities)
5. [Entity types](#entity-types)
6. [Entity states](#entity-states)
7. [Automations](#automations)
8. [Triggers](#triggers)
9. [Automation management](#automation-management)
10. [Agent tools](#agent-tools)
11. [Summarization](#summarization)
12. [Graph completeness](#graph-completeness)
13. [Consistency guard](#consistency-guard)
14. [Consistency issue types](#consistency-issue-types)
15. [Consistency issue resolution](#consistency-issue-resolution)
16. [Versioning](#versioning)
17. [Settings](#settings)
18. [Getting started](#getting-started)

---

## Harness and products

![Harness and products](docs/slide-images/01-harness-and-products.png)

Momentum works in **three layers**. Attention is shared across all projects; understanding and implementation exist once per project.

| Layer | What it does |
|---|---|
| **Attention** | One feed across enabled projects, ranked by `product_impact + timeline_impact + unlocks`. Your reactions: approve, send back, resolve an issue, won't resolve. |
| **Understanding** | The knowledge graph: entity cards in each project's `knowledge-graph/`, indexed for Graph RAG search. The consistency guard validates every change. |
| **Implementation** | Claude Code runs, one process and one detached checkout of the main line each, started by the orchestrator and landed on the main line when they end. |

The **harness** is what you use and what runs it:

- **The app** (`apps/app`): Feed, Explorer, Sessions, Timeline, Metrics and Settings.
- **The back end** (`apps/backend`): one Node process holding the **API** (typed HTTP routes, voice sockets, MCP tools at `/mcp`), the **orchestrator**, the **runner** and the **consistency guard**. Runs, search answers and risk estimates are the only separate processes.

The dashed line on the slide is the border between **unverified** and **verified**: a run's work arrives on the left, and only your approval moves it across.

## User actions

![User actions](docs/slide-images/02-user-actions.png)

One Expo (React Native) app for web and mobile. On a phone the tabs sit in a bottom bar and Settings is an icon in the corner; on a wide screen all six tabs sit in a left rail.

On a **Feed** card:

- **Swipe right**: approve. One commit sets the entity verified, takes it out of the feed and syncs what it `implements`. An implementable entity with nothing implementing it starts **Implementation**.
- **Swipe left**: rework. Send it back with a comment, which starts a chat run on the entity, or joins the one already open. The card leaves the feed while the chat works and returns if the chat leaves it unverified.
- **Pull up**: ask. Opens a chat on the card with the whole card as context.
- **Select part of a card** to add just that part to a chat's context.
- **Resolve** or **won't resolve** an issue card: see [Consistency issue resolution](#consistency-issue-resolution).

A card that changed since you last verified it shows the diff. Counters above the cards show entities by verification and sync state. When the back end is out of reach, your reactions queue and are sent once it is back.

The other tabs:

- **Explorer**: pick a project, browse its domain and type tree, search or ask a question (also by microphone), or explore through an agent.
- **Sessions**: your chats and interviews, and the automation runs, filtered by all, yours or automations.
- **Timeline**: every run, reaction and harness event, newest first, plus the runs queued and running.
- **Metrics**: usage of the rolling 5-hour and weekly limits, automations, trends over time, runs by parameter and retrieval quality.

Beyond the feed:

- **Chat** and **interview**, by text or by voice ("interview \<topic\>").
- **Stop a run** from its conversation: what it wrote still lands.
- **Run an automation on demand**, through the `run_automation` tool.
- **Enable, build or reset projects** in Settings.
- **Edit entities** by committing to the main line.
- **Change settings**: limits, models, lifetimes.

**Patterns**: when your last ten reactions to one entity type were all the same, a `Harness/Pattern` proposal ("Approve \<type\> items automatically") enters the feed. Approving it counts it in the attention metrics.

## How everything works together

![How everything works together](docs/slide-images/03-how-everything-works-together.png)

One loop, for every enabled project:

1. **Triggers** queue runs on a schedule, on an event, or on demand. The orchestrator checks them every 30 seconds and on every event.
2. **Runs** start, each a Claude Code session in its own detached checkout of the main line. Automation runs go one at a time per project. Runs you start go at once. All of them count toward the concurrent-runs limit.
3. **Work**: the run writes code, plans, documents and entity cards. The guard checks every write as it happens.
4. **Summarization**: before the run ends, its Stop hook hands every artifact it changed to the summarization sub-agent, which turns them into entity cards.
5. **Consistency guard**: the run lands as one transaction and one commit on the main line. Every entity it wrote lands unverified. What fails validation lands too, with a `Harness/Issue` over it.
6. **Attention feed**: the index updates, and the unverified entities enter the feed, ranked.
7. **You** react. Approving an implementable entity that nothing implements yet starts **Implementation**. A finished implementation starts **Validation**.

**Your own commits** need no run and are not validated, but the guard indexes them: unverified entities in them enter the feed, and changed artifacts mark the entities over them `artifact_ahead` and start one summarization run.

## Entities

![Entities](docs/slide-images/04-entities.png)

An **entity is its card**: one Markdown file in the project's `knowledge-graph/` directory.

- **The type is the path**: `knowledge-graph/<Domain>/<Type>/[<parent>/]<name>.md`. The `type` in the frontmatter must match the directory.
- **The file**: YAML frontmatter, then a `# Title`, then the card body. The card has no fixed structure; diagrams are PlantUML.
- **The character limit** (700 by default, in Settings) keeps a card readable on a phone. Runs are told the limit and split an entity that does not fit into entities that reference each other.

Frontmatter:

| Field | Values |
|---|---|
| `type` | `<Domain>/<Type>`, one of the 151 types |
| `origin` | `user`, `requested` or `automation` |
| `verification` | `unverified` (default) or `verified` |
| `sync` | `synced` (default), `entity_ahead`, `artifact_ahead` or `updating` |
| `product_impact`, `timeline_impact`, `unlocks` | 0 to 5; their sum ranks the feed |
| `references` | `{ to, relation }`: links to other entities |
| `artifacts` | repository paths the entity accounts for; a directory claims everything in it |

**References** must resolve to an existing entity. The relation is any snake_case verb. The harness acts on three: `implements` (sync and implementation), `plans` (a plan and the work it plans) and `concerns` (an issue and the entities it is about). A card may link the entities it names, as `[text](Domain/Type/name)`; every link must also be a reference.

**Artifacts** are the files outside `knowledge-graph/` that the entity summarizes: an entity with artifacts is a **summary**.

**Search** fuses Postgres full-text search with local embeddings (`bge-small-en-v1.5`) by reciprocal rank. The agents' search and the **Ask** answers then walk the references both ways (Graph RAG), one to three hops deep.

## Entity types

![Entity types](docs/slide-images/05-entity-types.png)

**151 types in 12 domains**, listed with a description each in [docs/entity-types.tsv](docs/entity-types.tsv). Each type is a directory: `knowledge-graph/<Domain>/<Type>/`.

| Domain | Types | Domain | Types |
|---|---|---|---|
| Product | 25 | Testing | 7 |
| Governance | 11 | Infrastructure | 24 |
| Architecture | 16 | Security | 9 |
| Code | 11 | Organization | 7 |
| Data | 18 | Knowledge | 5 |
| Frontend | 10 | Harness | 8 |

The **Harness** domain is Momentum's own: `Automation`, `Trigger`, `Issue`, `Conflict`, `Plan`, `Research`, `Pattern` and `Report`.

Seven types are **implementable**: approving one with nothing implementing it starts an implementation. They are `Product/Feature`, `FeatureRequest`, `UserStory`, `DevTask`, `Bug`, `TechDebt` and `Harness/Plan`.

## Entity states

![Entity states](docs/slide-images/06-entity-states.png)

**Verification** is your judgement:

- **unverified**: in the feed. Every entity a run writes lands unverified, whatever its frontmatter said.
- **verified**: out of the feed. Only you verify: by approving, or by marking an issue won't resolve.

Your own edits to entity files keep the verification the file states.

**Sync** tracks an entity against its artifacts and its implementation:

| State | Set when | Leaves when |
|---|---|---|
| `synced` | Nothing below applies (the default) | |
| `entity_ahead` | An implementable entity is verified, and nothing verified implements it | Approving a result that `implements` it sets it back to `synced` |
| `artifact_ahead` | An artifact changed on the main line without its entity, or a summarization run failed | A summarization run rewrites the entity |
| `updating` | A run targeting the entity is created, already while it is queued | The run lands, or is killed while queued |

`entity_ahead` starts an **Implementation** run. `artifact_ahead` starts a **Summarization** run. `artifact_ahead` and `updating` live only in the index and are never committed to the file.

**Contradictions** count the open `contradiction` issues that `concern` the entity, leaving out those marked won't resolve.

## Automations

![Automations](docs/slide-images/07-automations.png)

Twelve automations, each defined by its responsibility:

| Automation | What it does | Started by |
|---|---|---|
| **Exploration** | Decides the next best action within the project's goals and researches what it needs | Schedule |
| **Preparation** | Finds tasks, issues and research that can start, and writes plans to `plans/` | Schedule |
| **Implementation** | Implements an approved entity; the work lands when the run ends | Event: `entity_ahead` |
| **Validation** | Validates an implementation once it has landed, and the project as it stands | Schedule, and event: `implementation_finished` |
| **Consistency check** | Checks consistency across all entities and raises each finding as a `Harness/Issue` | Schedule |
| **Retention** | Retires entities whose lifetime is spent, by the lifetime rules per type | Schedule |
| **Optimization** | Analyses every chat for repeating patterns and proposes skills, memories, sub-agents, definition and trigger changes | Schedule, harness workspace only |
| **Summarization** | Summarizes the artifacts a run added, changed or deleted into entities | A run's Stop hook (as a sub-agent), and `artifact_ahead` (as its own run) |
| **Graph build** | Builds the knowledge graph, run after run, until the repository is covered | Enabling the project |
| **Chat** | The direct chat with you | You |
| **Interview** | Interviews you one question at a time to write one document in `interviews/` | You |
| **Search** | Answers a question from the entities a search found, in one pass | You, in Explorer; one model turn, no run |

**One project, two lanes:**

- **Automation runs** queue and run one at a time per project. Different projects run side by side.
- **Runs you start** (a chat, an interview, a send back, an issue resolution, a run on demand) start at once, alongside them.

Both lanes share the **concurrent runs in total** limit (8 by default).

## Triggers

![Triggers](docs/slide-images/08-triggers.png)

A **trigger** is a `Harness/Trigger` entity that says when an automation runs:

```yaml
automation: consistency-check
schedule: "0 3 * * *"   # cron, server local time
events: []              # entity_ahead, implementation_finished
on_demand: true
```

The default triggers come from `automations/<name>/trigger.md`:

| Automation | Schedule | Events |
|---|---|---|
| Exploration | `0 */2 * * *`: every two hours, on the hour | |
| Preparation | `30 */2 * * *`: every two hours, at half past | |
| Validation | `0 2 * * *`: 02:00 | `implementation_finished` |
| Consistency check | `0 3 * * *`: 03:00 | |
| Retention | `0 4 * * *`: 04:00 | |
| Optimization | `0 5 * * *`: 05:00, harness workspace only | |
| Implementation | | `entity_ahead` |
| Chat, Interview | on demand only | |

All the defaults have `on_demand: true`. A run on demand is refused when its trigger does not allow it.

**Without a trigger entity:** Summarization runs from every run's Stop hook and on `artifact_ahead`. Graph build runs while the project is enabled, until the build is complete. Search answers in one turn, without a run.

**At the feed limit**, scheduled triggers and the graph build stop queueing new runs until the feed has room again. Event runs, your runs and summarization keep going.

## Automation management

![Automation management](docs/slide-images/09-automation-management.png)

Automations are entities too, so they change through the feed like everything else.

- **Definitions** are `Harness/Automation` entities in the harness workspace (this repository). Their artifacts are the Claude Code files in `automations/<name>/`: the agent `agents/momentum-<name>.md`, the default `trigger.md`, and for implementation the risk rules `risk.md`.
- **Triggers** are `Harness/Trigger` entities in each workspace. When you enable a project that has none, the defaults are committed to its main line; they take effect at once and wait in the feed for review.
- **Materialization**: each definition is copied into every enabled workspace's `.claude/` (kept out of git through `.git/info/exclude`). This happens on enable and whenever a definition changes on the harness main line.
- **In effect as they stand**: definitions and triggers work as soon as they land on the main line. Verification is your review, not a gate.
- **Optimization** tracks each recurring pattern as a `Harness/Pattern` and proposes a change once it has seen it three times.
- **Scope in the harness repository**: chat, interview and implementation may change anything; preparation only `plans/`; optimization only `automations/`; every other automation only `knowledge-graph/`. Changes outside the scope are put back.

You can **stop a run** (what it wrote still lands; a queued run never starts), **steer a run** or resume an ended one with a message, pick **models** and set **concurrent runs in total**. An automation **runs on demand** through the `run_automation` MCP tool.

## Agent tools

![Agent tools](docs/slide-images/10-agent-tools.png)

What a run's agent can use:

- **Claude Code built-in tools**, all of them, with permissions bypassed, in the run's own checkout. The checkout's project settings apply, including its hooks.
- **`momentum-kb`** (in-process MCP), the project's knowledge base:

  | Tool | Does |
  |---|---|
  | `search` | Full text, embeddings and Graph RAG |
  | `read`, `references` | An entity, and its links both ways |
  | `types` | The entity types and what each is for |
  | `write` | Writes an entity, validated on write |
  | `record_agent_metric` | Records misalignments and recurring issues |

- **`momentum-run`** (in-process MCP), what the run reports to the harness: `report_graph_build` (progress, next, documents), `report_interview` (interview runs only) and `retrieval_ratings` (optimization only).
- **The `momentum-summarization` sub-agent**, the one sub-agent the harness provides.
- **Hooks** that put the consistency guard inside the run:
  - `PostToolUse` checks every `Write`, `Edit`, `MultiEdit`, `NotebookEdit` and `momentum-kb` write, and tells the agent what the guard will not accept.
  - `Stop` asks for summarization, then for fixes to the guard's issues (at most twice), then for the commit message.
  - `SubagentStop` records that summarization ran.

Each run is held by Process Governor to 4 GB of memory and 4 CPU cores by default, and cannot see the harness's database credentials. After a run, its retrieval calls are rated for relevance by Haiku, and optimization reads the ratings.

**Your voice tools** are separate: the **`momentum`** MCP server over HTTP at `/mcp`, behind your session. It is the API without the UI: feed, approve, send back, resolve issues, entities, search, ask, chats, runs, graph build, metrics, timeline and settings. Runs do not get it.

## Summarization

![Summarization](docs/slide-images/11-summarization.png)

**When a run stops**, its Stop hook stops it once more and asks it to run the `momentum-summarization` sub-agent over everything it changed: the files added, changed or deleted against the run's base commit, the documents a graph-build run listed, and an interview's document once the interview is done.

The sub-agent writes **one summary entity per coherent piece of work**, not one per file:

- It rewrites the entity already over an artifact rather than adding one beside it, and leaves a card alone when it is still true.
- It re-points moved artifacts, drops deleted ones, and deletes entities left with no artifact.
- The results of an implementation reference its target with `implements`.

**Never summarized**: `knowledge-graph/`, the chat transcripts in `chats/` (they are left for optimization), and the patterns in Settings → Summarization.

**Your own commits**: a changed artifact marks the entities over it `artifact_ahead`, and one summarization run covers all of them, rewriting a card only where the change makes it wrong or adds to it. New files that no entity covers are summarized once the graph build is complete.

## Graph completeness

![Graph completeness](docs/slide-images/12-graph-completeness.png)

How well a project is understood: **the mean of two halves**, measured by the harness on the main line, never estimated by a run.

**Understanding**: eight questions a reader needs answered. Each is answered by any entity of one of its types; the score is answered questions out of eight.

| Question | Types that answer it |
|---|---|
| What the product is | Product/Product |
| What it is for | Product/Goal, Initiative, RoadmapItem |
| What it does | Product/Capability, Feature, UseCase, UserJourney |
| How it is built | Architecture/System, Service |
| Where the code is | Code/Repository |
| Where it runs | Infrastructure/Environment, Deployment, CiCdPipeline |
| How it is tested | Testing/TestSuite, TestPlan, TestCase |
| What rules and decisions shape it | Governance/Decision, Constraint, Requirement, DesignDoc, Policy; Product/BusinessRule |

**Territory**: every area of the repository accounted for.

- An **area** is a top-level directory. A directory that holds only directories, like `apps/` or `packages/`, is replaced by its children. Root files form one area.
- An area counts by its **parts**: its subdirectories, plus its own files as one part. A part is claimed when an entity lists it, anything inside it, or a directory above it in `artifacts`.
- Areas are weighted by `log2(1 + files)`.
- Detail types claim nothing: `Code/SourceFile`, `Class`, `Function`, `Commit`, `Data/Column`, `Index`, `Frontend/FormField` and `LocalizationString`. The graph exists to spare the reader those.
- `knowledge-graph`, `chats`, `.claude`, `.git` and the never-summarized patterns are left out.

**Graph build**: each build run is told the gaps, writes at most as many entities as the feed has room for, and reports its progress. The build is **complete** when a run reports that nothing missing can be found in the repository. Three failed build runs in a row stop it until you resume it.

## Consistency guard

![Consistency guard](docs/slide-images/13-consistency-guard.png)

The **consistency guard** keeps the knowledge base consistent while runs write freely.

Every entity is validated for:

- `parse`: a readable file
- `unknown_type`: the type is in `entity-types.tsv`
- `type_path_mismatch`: the type matches its directory
- `mermaid_diagram`: diagrams are PlantUML
- `unresolved_reference`: every reference resolves
- `unlisted_link`: every linked entity is among the references

**During the run**, the `PostToolUse` hook checks every write, and the `Stop` hook has the run fix what fails, at most twice.

**When the run ends**, whether it finished, failed or was killed, the guard lands it as **one transaction**:

1. Puts back changes outside the automation's scope (harness repository only).
2. Validates every changed entity, and every deleted entity something still references.
3. Writes a `Harness/Report` for the entities the run removed.
4. Sets every entity the run wrote to unverified.
5. Raises a `Harness/Issue` over what failed. **Everything lands.**
6. Commits, lands and indexes in one step, and updates the index and metrics database.

A run whose files changed on the main line meanwhile lands with a `Harness/Conflict` (see [Versioning](#versioning)).

The **consistency check** runs every night at 03:00. It reads the knowledge graph only, never the artifacts, trusting the summaries, and raises one `Harness/Issue` per finding, `concerning` the entities involved.

## Consistency issue types

![Consistency issue types](docs/slide-images/14-issue-types.png)

The consistency check sets exactly one `category` per issue.

**By rule**, found with queries and rules:

- `reference`: an unresolved reference, or a linked entity not among the references.
- `type-path`: a type not in `entity-types.tsv`, or not matching its directory.

**By reading** the cards, with a `severity`:

| Severity | Category | Raised when |
|---|---|---|
| High | `contradiction` | Other entities state the opposite of this one |
| High | `logical` | The entity contradicts itself |
| High | `ambiguity` | The entity can be read more than one way |
| Medium | `design-gap` | A flow, mechanism or rule it needs is missing |
| Medium | `naming` | A name not introduced, two names for one concept, or one name for two |
| Medium | `repetition` | Other entities restate the same information |
| Low | `verbose` | More words than meaning |
| Low | `struct` | The format hides the information |
| Low | `split` | A fragment of another entity |

**One issue per finding**, raised and never fixed by the check, and none where an existing issue already covers it. Each issue:

- `concerns` the entities involved, the one at fault first (at least two for a contradiction, repetition or split).
- Offers 2–4 `options`, each a label and a change, with a `recommended` one when one is clearly best.
- Is scored on `product_impact`, `timeline_impact` and `unlocks`.

The guard's own issues (`source: guard`) and conflicts carry no category or options.

## Consistency issue resolution

![Consistency issue resolution](docs/slide-images/15-issue-resolution.png)

An issue card in the feed shows its severity, its category, the entities it concerns (the one at fault marked), and its options, with the recommended one marked and picked.

- **Swipe right**: resolve with the picked option.
- **Swipe left**: write your own resolution, or **won't resolve**.

A resolution starts a **chat run** that applies it to the concerned entities and deletes the issue. If a chat is already open on the issue, the resolution goes to it as a message. The changed entities land unverified and come back to the feed.

**Won't resolve** needs a reason. It is one commit that keeps the issue, verified, with the reason in its `wont_resolve` frontmatter. The check skips findings an existing issue covers, and the issue no longer counts as a contradiction.

A guard issue or a conflict has no options: approve it, or send it back to start a chat run on it.

## Versioning

![Versioning](docs/slide-images/16-git.png)

**The main line is the only branch.** Enabling a project with another branch, a detached HEAD or a merge is refused, and an enabled project that gains one is switched off.

- **Every run** works in its own detached checkout, created when it starts and removed when it ends.
- **One commit per run**, by `Momentum <momentum@localhost>`, with the message the run wrote. A run that changed nothing makes no commit.
- **Untouched tip**: the main line fast-forwards to the run's commit.
- **Moved tip**: the run is replayed onto the new tip as one commit, by a three-way merge. Files that conflict take the run's version whole, and a `Harness/Conflict` lands in the same commit.
- **Reactions** (approve, won't resolve, default triggers) are commits too, made without touching any working tree. A reaction to a card that changed meanwhile is refused.
- **Your commits** are indexed on every orchestrator tick (see [Summarization](#summarization)).
- **Your checkout follows** the main line: clean files are updated, files you changed are left alone.

## Settings

![Settings](docs/slide-images/17-settings.png)

| Section | Setting | Default |
|---|---|---|
| **Appearance** | Theme: System, Light or Dark, on this device | System |
| **Included projects** | Enable a project to start its loops; a logo; the knowledge graph build: stop, resume, reset | |
| **Feed size** | Items before loops pause | 40 |
| **Cards** | Character limit, sized so a card fits on a phone | 700 |
| | Presentation rules | empty |
| **Summarization** | Never summarized: path patterns such as `**/*.lock` | empty |
| **Lifetimes** | When retention retires each type | `Product/DevTask`: 30 days after resolved, unless referenced; `Harness/Research`: 60 days after delivered; `Governance/Decision`: kept while referenced |
| **Agents** | Concurrent runs in total, across projects | 8 |
| **Models** | One model, Per automation, or By risk; choices Default, Fable, Opus, Sonnet, Haiku | One model: Default (Claude Code's own) |
| **In the knowledge graph** | Automations, entity types, risk rules, and each project's triggers and patterns, opened where they live | |
| **This device** | Sign out; other devices stay signed in | |

- **Enabling** a project requires one straight line. It indexes the project, proposes the default triggers and starts the graph build.
- **Reset** asks first. It ends every run, deletes the knowledge graph from the main line in one commit, drops the project's index, and builds again. The harness itself cannot be reset.
- **By risk** applies to implementation: Haiku estimates each implementation's risk from `automations/implementation/risk.md` and picks Haiku, Sonnet or Opus. Per automation, everything is Default except search, which uses Sonnet.

Every settings change is recorded on the Timeline.

---

## Getting started

### Requirements

- **Windows**. Runs are held in Windows job objects and the service scripts are PowerShell.
- **Node.js 24+** and **pnpm 10**.
- **git**, with a user name and email configured.
- **PostgreSQL with pgvector**, for example the `pgvector/pgvector` Docker image. Create the database first; the extension and schemas are created on start.
- **Claude Code, signed in**. Every run is a Claude Code session under your account and uses its usage limits.
- **[Process Governor](https://github.com/lowleveldesign/process-governor)** (`procgov`). Without it every run fails.
- **[Tailscale](https://tailscale.com)**. The API listens only on the tailnet, so no port is exposed to the internet. Set `MOMENTUM_HOST` to develop on one machine without it.
- Optional: a **PlantUML server** on `localhost:8080` to draw the diagrams in cards.

### Install

The repository must sit directly under the workspaces root as a directory named `momentum`, e.g. `C:\Projects\momentum`. Every other git repository directly under the root is a workspace.

```bash
pnpm install
```

Create `.env` in the repository root:

```ini
DATABASE_URL=postgres://user:password@127.0.0.1:5432/momentum
MOMENTUM_ROOT=C:\Projects
MOMENTUM_PROCGOV=C:\Tools\procgov.exe
MOMENTUM_HOST=127.0.0.1
```

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | required | Index and metrics database |
| `MOMENTUM_ROOT` | `C:\Projects` | Workspaces root |
| `MOMENTUM_HOST` | the Tailscale IPv4 address | Address the API listens on |
| `MOMENTUM_PORT` | `7300` | API port |
| `MOMENTUM_PROCGOV` | `procgov` | Process Governor executable |
| `MOMENTUM_RUNS` | `<root>\.runs` | Run checkouts |
| `MOMENTUM_RUN_MEMORY` | `4G` | Memory per run, child processes included |
| `MOMENTUM_RUN_CPUS` | `4` | CPU cores per run |
| `MOMENTUM_RUN_DATABASE_URL` | none | A database a run may use, given to it as `DATABASE_URL` |
| `MOMENTUM_TICK_MS` | `30000` | How often the orchestrator checks triggers |
| `MOMENTUM_MODELS` | `<root>\.momentum\models` | Embedding model cache |
| `MOMENTUM_PLANTUML_URL` | `http://localhost:8080` | PlantUML server |
| `MOMENTUM_COMMAND_STREAM` | `http://127.0.0.1:8780` | External speech-to-command service, for voice |
| `MOMENTUM_VOICE_SOURCES` | `remote` | Audio sources acted on, comma-separated |
| `MOMENTUM_APP_DIST` | `apps/app/dist` | Web app build the back end serves |
| `LOG_LEVEL` | `info` | Server log level |

The first start downloads the embedding model (`Xenova/bge-small-en-v1.5`) from Hugging Face. No API key is needed.

### Run

The server does not start without a password. Generate one; it is written to `<root>\.momentum\password.txt`:

```bash
pnpm momentum generate-password
```

Start the back end and the web app. The back end restarts on every change, and the web app is exported again when its sources change:

```bash
pnpm dev
```

Open `http://<MOMENTUM_HOST>:7300` and sign in. Then enable a project to start its graph build and loops:

```bash
pnpm momentum enable <workspace>
```

To serve Momentum at every logon, run `apps/backend/service/install.ps1` once. It registers a scheduled task that waits for Postgres and runs `pnpm dev`.

**Native app**: build with `EXPO_PUBLIC_API_URL` set to the back end's address, e.g. an Android APK with `pnpm --filter @momentum/app android:apk` (needs the Android SDK and a JDK).

### CLI

`pnpm momentum <command>`; when a server is running, the command goes through it.

| Command | What it does |
|---|---|
| `generate-password` | Writes a new password to `<root>\.momentum\password.txt` and ends all sessions |
| `set-password [password]` | Sets the password, asking for it if not given, and ends all sessions |
| `enable <workspace>` / `disable <workspace>` | Starts or stops a project's loops |
| `logo <workspace> <file \| --remove>` | Sets the project's logo (.png, .jpg, .webp, .svg); a relative path is read from `apps/backend` |
| `index [workspace...]` | Indexes the main line afresh |
| `openapi` | Writes `packages/contract/openapi.json` |

### Test

Unit tests need the Postgres from `.env`, with a role allowed to create databases:

```bash
pnpm test
```

```bash
pnpm typecheck
```

The end-to-end scenarios run in Playwright on Firefox, through a test runner at `127.0.0.1:7400` (`pnpm e2e:runner` opens it). Some scenarios call real Claude models and use your usage limits:

```bash
pnpm e2e
```

### Repository layout

| Path | Contents |
|---|---|
| `apps/backend` | API, orchestrator, runner, consistency guard, voice, CLI and the Windows service scripts |
| `apps/app` | The web and mobile app (Expo, React Native) |
| `packages/contract` | Zod schemas shared by app and back end; `openapi.json` |
| `packages/entity` | Entity parsing, validation, links, card rendering and PlantUML |
| `packages/kb` | The knowledge base: Postgres schema, index, search, embeddings, the `momentum-kb` MCP tools |
| `packages/runs` | Git, run processes and Claude Agent SDK sessions |
| `automations` | One directory per automation: its agent and default trigger |
| `knowledge-graph` | Momentum's own knowledge graph |
| `chats` | Chat transcripts |
| `examples` | Sample projects for the end-to-end scenarios |
| `docs` | Slide deck and its sources, slide images, entity types |
| `video` | The walkthrough video (Remotion) |
| `scripts` | `dev.mjs`, the development server |

`pnpm deck` builds `docs/harness-diagram.pptx`. `pnpm video` renders `video/out/momentum.mp4`; its voice step needs a separate speech project.

### Working rules

Momentum works on one straight line: no branches, no merges, in this repository and in the projects it runs. Every change is committed straight to `main`.

## License

Momentum is licensed under the [Apache License 2.0](LICENSE).
