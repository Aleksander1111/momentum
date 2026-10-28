# Momentum

**A self-hosted harness around Claude Code: the single entry point between you and the work around all your projects.**

Every git repository under one root directory is a workspace. For each project you enable, Momentum builds a knowledge graph of short entity cards, runs Claude Code automations that explore, plan, implement, validate and summarize the work, and brings everything that needs your judgement into one ranked feed across projects, on the web or on your phone.

Everything a run writes lands on the main line **unverified** and waits in the feed. Swipe right to approve it, swipe left to send it back with a comment. Only you verify.

## Video

https://github.com/user-attachments/assets/97e31b2e-efcc-4aca-b49c-1f102181a758

🎬 [Watch the walkthrough on YouTube](https://youtu.be/JHQ4OpeXyJo)

## Contents

1. [Quick start](#quick-start)
2. [Harness and products](#harness-and-products)
3. [User actions](#user-actions)
4. [How everything works together](#how-everything-works-together)
5. [Entities](#entities)
6. [Entity types](#entity-types)
7. [Entity states](#entity-states)
8. [Automations](#automations)
9. [Triggers](#triggers)
10. [Automation management](#automation-management)
11. [Agent tools](#agent-tools)
12. [Summarization](#summarization)
13. [Graph completeness](#graph-completeness)
14. [Consistency guard](#consistency-guard)
15. [Consistency issue types](#consistency-issue-types)
16. [Consistency issue resolution](#consistency-issue-resolution)
17. [Versioning](#versioning)
18. [Metrics](#metrics)
19. [Settings](#settings)
20. [Getting started](#getting-started)

---

## Quick start

From a clean Windows machine to a project Momentum works on, and back out of any automation that project does not want. [Getting started](#getting-started) has every option.

**What it gives you**: Claude Code automations explore, plan, implement, validate and summarize the work in each enabled project, and everything they write waits for your approval in one feed across projects.

### 1. Install

Install the [requirements](#requirements): Windows, Node.js 24+, pnpm 10, git, Claude Code signed in, [Process Governor](https://github.com/lowleveldesign/process-governor) and Docker for Postgres. Then:

```bash
docker run -d --name momentum-db -e POSTGRES_PASSWORD=momentum -e POSTGRES_DB=momentum -p 5432:5432 pgvector/pgvector:pg17
```

```bash
git clone https://github.com/Aleksander1111/momentum C:\Projects\momentum
```

In `C:\Projects\momentum`:

```bash
pnpm install
```

`C:\Projects\momentum\.env`, for one machine without Tailscale:

```ini
DATABASE_URL=postgres://postgres:momentum@127.0.0.1:5432/momentum
MOMENTUM_ROOT=C:\Projects
MOMENTUM_PROCGOV=C:\Tools\procgov.exe
MOMENTUM_HOST=127.0.0.1
```

### 2. Run

```bash
pnpm momentum generate-password
```

```bash
pnpm dev
```

Open `http://127.0.0.1:7300` and sign in with the password from `C:\Projects\.momentum\password.txt`.

### 3. Check that it works

```bash
pnpm typecheck
```

```bash
pnpm test
```

Both pass against the Postgres above. Then enable a project: any git repository directly under `C:\Projects`, on one straight line with no other branch or worktree:

```bash
pnpm momentum enable <workspace>
```

Within a minute **Sessions** shows the project's **Knowledge graph** run, and the **Feed** shows the project's default triggers as cards waiting for your review. Its first entity cards follow as the build goes on, run by run while the feed has room. `pnpm momentum enable <workspace> --full` has the build go on whatever the feed holds, until the graph is complete.

### 4. Tighten or switch off an automation in one project

Both are a commit on the project's main line, in effect at once. The other projects keep the shared definition.

- **Tighten**: copy `automations/<name>/agents/momentum-<name>.md` from this repository to the same path in the project, edit the prompt, and commit it with the reasons in the message. The Timeline shows the override with that message. Delete the file to go back to the shared prompt. See [Automation management](#automation-management).
- **Switch off**: in the project's `knowledge-graph/Harness/Trigger/<name>.md`, remove `schedule`, set `events: []` and `on_demand: false`, and commit. The automation no longer runs in that project. Put the values back to switch it on. See [Triggers](#triggers).

---

## Harness and products

![Harness and products](docs/slide-images/01-harness-and-products.png)

Momentum works in **three layers**. Attention is shared across all projects; understanding and implementation exist once per project.

| Layer | What it does |
|---|---|
| **Attention** | One feed across enabled projects, ranked by `product_impact + timeline_impact + unlocks`. Your reactions: approve, send back, resolve an issue, won't resolve. |
| **Understanding** | The knowledge graph: entity cards in each project's `knowledge-graph/`, indexed for Graph RAG search. The consistency guard validates every change. |
| **Implementation** | Claude Code runs, one process each, working in the project's own working directory on the main line, one at a time per project, started by the orchestrator and landed on the main line when they end. |

The **harness** is what you use and what runs it:

- **The app** (`apps/app`): Feed, Explorer, Sessions, Timeline, Metrics and Settings.
- **The back end** (`apps/backend`): one Node process holding the **API** (typed HTTP routes, voice sockets, MCP tools at `/mcp`), the **orchestrator**, the **runner** and the **consistency guard**. Runs, search answers and risk estimates are the only separate processes.

The dashed line on the slide is the border between **unverified** and **verified**: a run's work arrives on the left, and only your approval moves it across.

## User actions

![User actions](docs/slide-images/02-user-actions.png)

One Expo (React Native) app for web and mobile. On a phone all six tabs sit in a bottom bar as icons alone; on a wide screen they sit in a left rail, each icon named under it.

On a **Feed** card:

- **Swipe right**: approve. One commit sets the entity verified, takes it out of the feed and syncs what it `implements`. An implementable entity with nothing implementing it starts **Implementation**.
- **Swipe left**: rework. Send it back with a comment, which starts a chat run on the entity, or joins the one already open. The card leaves the feed while the chat works and returns if the chat leaves it unverified.
- **Pull up**: ask. Opens a chat on the card with the whole card as context.
- **Select part of a card** to add just that part to a chat's context.
- **Resolve** or **won't resolve** an issue card: see [Consistency issue resolution](#consistency-issue-resolution).

A card that changed since you last verified it shows the diff. Counters above the cards show entities by verification and sync state. When the back end is out of reach, your reactions queue and are sent once it is back.

The other tabs:

- **Explorer**: pick a project, browse its domain and type tree, search or ask a question (also by microphone), or explore through an agent. An entity opened there is the same card as in the feed: swipe it to approve, resolve or ask for rework, or pull it up to chat about it.
- **Sessions**: your chats and interviews, and the automation runs, filtered by all, yours or automations.
- **Timeline**: every run, reaction and harness event, newest first, plus the runs queued and running. A chat is one event, named after what was done in it, for the latest thing done in it, with everything it landed.
- **Metrics**: usage of the rolling 5-hour and weekly limits, automations, trends over time, runs by parameter and retrieval quality.

Beyond the feed:

- **Chat** and **interview**, by text or by voice ("interview \<topic\>").
- **Attach files** to a chat message: pick them with the paperclip, paste them into the field or drop them on it, up to 10 files of 10 MB each. They are kept on the PC, outside the project, and the agent reads them where they are.
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
2. **Runs** start, each a Claude Code session in the project's one working directory, on the main line. A project's runs go one at a time there, the ones you start first. All of them count toward the concurrent-runs limit.
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
| `type` | `<Domain>/<Type>`, one of the 150 types |
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

**150 types in 12 domains**, listed with a description each in [docs/entity-types.tsv](docs/entity-types.tsv). Each type is a directory: `knowledge-graph/<Domain>/<Type>/`.

| Domain | Types | Domain | Types |
|---|---|---|---|
| Product | 25 | Testing | 7 |
| Governance | 11 | Infrastructure | 24 |
| Architecture | 16 | Security | 9 |
| Code | 11 | Organization | 7 |
| Data | 18 | Knowledge | 5 |
| Frontend | 10 | Harness | 8 |

The **Harness** domain is Momentum's own: `Automation`, `Trigger`, `Issue`, `Plan`, `Research`, `Pattern` and `Report`.

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

**One project, one working directory, one run at a time:**

- **Every run** of a project works in the project's own folder, on the main line, and waits while another run works there. Different projects run side by side.
- **Runs you start** (a chat, an interview, a send back, an issue resolution, a run on demand) wait only for the run working in their project, and start ahead of every automation run queued there.

All runs share the **concurrent runs in total** limit (8 by default).

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
- **Materialization**: each definition is copied into every enabled workspace's `.claude/` (kept out of git through `.git/info/exclude`). This happens on enable, whenever a definition changes on the harness main line, and whenever a project's override changes on its main line.
- **Overrides per project**: a project replaces an automation's prompt by committing its own `automations/<name>/agents/momentum-<name>.md` to its main line, the path the harness keeps the definition's agent file at. The project's file is materialized there in place of the harness's. The commit message gives the reasons, and the Timeline shows the override, and its removal, with that message. The shared definition stays the one in this repository: the other projects keep it.
- **In effect as they stand**: definitions, overrides and triggers work as soon as they land on the main line. Verification is your review, not a gate.
- **Optimization** tracks each recurring pattern as a `Harness/Pattern` and proposes a change once it has seen it three times.
- **Scope in the harness repository**: chat, interview and implementation may change anything; preparation only `plans/`; optimization only `automations/`; every other automation only `knowledge-graph/`. Changes outside the scope are put back.

You can **stop a run** (what it wrote still lands; a queued run never starts), **steer a run** or resume an ended one with a message, pick **models** and set **concurrent runs in total**. An automation **runs on demand** through the `run_automation` MCP tool.

## Agent tools

![Agent tools](docs/slide-images/10-agent-tools.png)

What a run's agent can use:

- **Claude Code built-in tools**, all of them, with permissions bypassed, in the project's working directory. The project's settings apply, including its hooks.
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

Each run is held by Process Governor to 4 GB of memory and 4 CPU cores by default, and cannot see the harness's database credentials. After every turn of a chat, Haiku names the chat after what was done in it, so the agent spends nothing on naming. After a run, its retrieval calls are rated for relevance by Haiku, and optimization reads the ratings.

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

**Graph build**: each build run is told the gaps, writes entities and reports its progress. The build is **complete** when a run reports that nothing missing can be found in the repository. Three failed build runs in a row stop it until you resume it. The build runs in one of two modes, chosen per project in Settings or with `pnpm momentum enable <workspace> --full`:

| Mode | When a run queues | What a run writes |
|---|---|---|
| **Paced** (default) | While the feed has room | At most as many entities as the feed has room for |
| **In full** | Whatever the feed holds, until the graph is complete | Every entity the layer of the repository it covers deserves |

The mode is the project's, kept through a stop, a disable and a reset.

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

The guard's own issues (`source: guard`) carry no category or options.

## Consistency issue resolution

![Consistency issue resolution](docs/slide-images/15-issue-resolution.png)

An issue card in the feed shows its severity, its category, the entities it concerns (the one at fault marked), and its options, with the recommended one marked and picked.

- **Swipe right**: resolve with the picked option.
- **Swipe left**: write your own resolution, or **won't resolve**.

A resolution starts a **chat run** that applies it to the concerned entities and deletes the issue. If a chat is already open on the issue, the resolution goes to it as a message. The changed entities land unverified and come back to the feed.

**Won't resolve** needs a reason. It is one commit that keeps the issue, verified, with the reason in its `wont_resolve` frontmatter. The check skips findings an existing issue covers, and the issue no longer counts as a contradiction.

A guard issue has no options: approve it, or send it back to start a chat run on it.

## Versioning

![Versioning](docs/slide-images/16-git.png)

**The main line is the only branch, and the project's folder the only working directory.** Enabling a project with another branch, a worktree, a detached HEAD or a merge is refused, and an enabled project that gains one is switched off.

- **Every run** works in the project's own working directory, on the main line. No worktree, no copy, no branch: one run at a time works there.
- **What you leave uncommitted** there stays yours: a run commits only what it changed itself, and puts back only its own changes.
- **One commit per run**, by `Momentum <momentum@localhost>`, with the message the run wrote, made in the working directory on top of the main line as it stands. A run that changed nothing makes no commit.
- **Your commits** made while a run works stay; the run's commit lands on top of them, on one straight line.
- **Reactions** (approve, won't resolve, default triggers) are commits too. The working directory follows: clean files take the new content, files a run is changing keep its changes with the reaction merged in. A reaction to a card that changed meanwhile is refused.
- **Your commits** are indexed on every orchestrator tick (see [Summarization](#summarization)).

## Metrics

![Metrics](docs/slide-images/17-metrics.png)

The **Metrics** tab shows one project at a time over the last **24 h, 7 d or 30 d**, and charts any metric over time.

| Group | Metrics | How it is measured |
|---|---|---|
| **Usage** | Share of the rolling 5-hour and weekly limits, in total and per automation | From every limit reading a run reports; each rise is split evenly among the runs running |
| **Attention** | Time per item, approved, rejected, sent back, patterns automated | One row per reaction, with the time you spent on the card |
| **Understanding** | Consistency, open issues | With every validated transaction. Consistency is the share of entities whose references all resolve; open issues are the unverified issues |
| **Entities** | Counts by verification and by sync state | From the history of every entity's state |
| **Implementation** | Outstanding issues, bugs, defects | With every validated transaction. Bugs are `Product/Bug` entities not yet verified and synced; defects are open issues raised by validation |
| **Agents** | Runs, failures, average time and usage per automation; misalignments, recurring issues | Every run. Misalignments and recurring issues are recorded by optimization |
| **Retrieval** | Precision, coverage, RAG score, tools in parallel, tool relevance | Haiku rates every turn of a run that searched: precision is the share of calls rated 3 of 5 or more, coverage how much of what the turn needed was found, the RAG score their mean |

**Runs by parameter** shows each automation's runs as histograms of usage, duration and messages. A count nothing has measured yet shows as no data, not zero. Optimization reads the retrieval ratings to improve the automations.

## Settings

![Settings](docs/slide-images/18-settings.png)

| Section | Setting | Default |
|---|---|---|
| **Appearance** | Theme: System, Light or Dark, on this device | System |
| **Included projects** | Folded under its heading, which counts the enabled; enable a project to start its loops; its row opens on a logo and the knowledge graph build: stop, resume, paced by the feed or in full, reset | |
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
- **In full** has a project's graph build go on whatever the feed holds, each run writing without a limit, until the graph is complete; **Pace** hands it back to the feed's room. See [Graph completeness](#graph-completeness).
- **Reset** asks first. It ends every run, deletes the knowledge graph from the main line in one commit, drops the project's index, and builds again. The harness itself cannot be reset.
- **By risk** applies to implementation: Haiku estimates each implementation's risk from `automations/implementation/risk.md` and picks Haiku, Sonnet or Opus. Per automation, everything is Default except search, which uses Sonnet.

Every settings change is recorded on the Timeline.

---

## Getting started

### Requirements

- **Windows**. Momentum runs on Windows only: runs are held in Windows job objects and the service scripts are PowerShell. On Linux only the [checks](#continuous-integration) run.
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
| `MOMENTUM_ATTACHMENTS` | `<root>\.attachments` | Files attached to chat messages |
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

Start the back end and the web app. Both serve the main line: the back end restarts whenever a commit changes its sources, and the web app is exported again whenever a commit changes the app or the contract. Edits in progress in the working directory, a run's or yours, never restart or reach them:

```bash
pnpm dev
```

Open `http://<MOMENTUM_HOST>:7300` and sign in. Then enable a project to start its graph build and loops, with `--full` to build the knowledge graph whatever the feed holds:

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
| `enable <workspace> [--full]` / `disable <workspace>` | Starts or stops a project's loops; `--full` has its knowledge graph build whatever the feed holds |
| `logo <workspace> <file \| --remove>` | Sets the project's logo (.png, .jpg, .webp, .svg); a relative path is read from `apps/backend` |
| `index [workspace...]` | Indexes the main line afresh |
| `export-graph <workspace> [zip file]` | Writes a zip of the web app with the project's knowledge graph beside it, `<root>\.momentum\exports\<workspace>-knowledge-graph.zip` unless a file is given, for someone without Momentum: unpacked, its `index.html` opens in any browser on any computer, from the file itself, as the Explorer of that one project, which searches the graph it carries and reaches no server |
| `openapi` | Writes `packages/contract/openapi.json` |

### Test

Unit tests need the Postgres from `.env`, with a role allowed to create databases:

```bash
pnpm test
```

```bash
pnpm typecheck
```

Among the unit tests, `apps/backend/test/definitions.test.ts` validates the automation definitions this repository ships: one directory per automation, the entity over its files, an agent file with its name, description and prompt, and a default trigger with valid fields.

The end-to-end scenarios run in Playwright on Firefox, through a test runner at `127.0.0.1:7400` (`pnpm e2e:runner` opens it). Some scenarios call real Claude models and use your usage limits:

```bash
pnpm e2e
```

### Continuous integration

GitHub Actions runs the checks on Linux (`.github/workflows/ci.yml`) on every push to `main` and every pull request: `pnpm typecheck` and `pnpm test`, the definition validation included, against a `pgvector/pgvector` service. The back end, the runs and the end-to-end scenarios need Windows and stay out of CI.

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
| `scripts` | `dev.mjs`, the development server; `export-web.mjs`, the web export from the main line |
| `.github/workflows` | The CI workflow: type check, unit tests and definition validation on Linux |

`pnpm deck` builds `docs/harness-diagram.pptx`. `pnpm video` renders `video/out/momentum.mp4`; its voice step needs a separate speech project.

### Working rules

Momentum works on one straight line: no branches, no merges, in this repository and in the projects it runs. Every change is committed straight to `main`.

## License

Momentum is licensed under the [Apache License 2.0](LICENSE).
