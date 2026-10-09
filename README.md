# Momentum

**You run a dozen projects. Each one changes every day. Momentum brings everything that needs your decision into one place.**

Momentum is a harness around Claude Code. It understands each of your projects as a knowledge graph of short cards, lets AI agents plan, build and check the work, and puts every result in one ranked feed on your phone. Swipe right to approve, swipe left to send it back. Nothing moves forward without you.

## Video

> 🎬 The walkthrough video is coming soon on YouTube.

<!-- Replace with: [![Momentum walkthrough](docs/slide-images/01-harness-and-products.png)](https://www.youtube.com/watch?v=VIDEO_ID) -->

## Contents

1. [Harness and products](#harness-and-products)
2. [Mobile app](#mobile-app)
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
14. [Issue types](#issue-types)
15. [Issue resolution](#issue-resolution)
16. [Git](#git)
17. [User actions](#user-actions)
18. [Settings](#settings)
19. [Getting started](#getting-started)

---

## Harness and products

![Harness and products](docs/slide-images/01-harness-and-products.png)

Momentum has two halves.

- **The harness** is what you use and what runs it: the app's tabs (**Feed**, **Explorer**, **Chat**, **Timeline**, **Metrics**, **Settings**) and the back end behind them (**API**, **Orchestrator**, **Runner**, **Consistency Guard**).
- **The products** are what the harness makes for each project, in three layers:
  - **Attention layer**: the **Attention Feed**, fed by **Ranking** and emptied by **Approval**.
  - **Understanding layer**: **Entity Cards** and the **Knowledge Graph**, held consistent by the **Consistency Guard**.
  - **Implementation layer**: automations such as **Chat**, **Interview**, **Preparation**, **Implementation** and **Graph Build**, started by the **Orchestrator**. What they leave behind (chats, interviews, plans, code, documents) is turned into cards by **Summarization**.

The **consistency border** runs down the middle: on the left everything is **unverified** and waits for you; on the right it is **verified**, because you approved it.

## Mobile app

![Mobile app](docs/slide-images/02-mobile-app.png)

The app is a feed of **entity cards**: one component, decision, feature or issue per card, short enough to read on a phone screen.

- **Swipe right** to approve. The card is verified and the work goes ahead.
- **Swipe left** to send it back, with a comment saying what should change.
- The tab bar takes you to **Explorer**, **Chat**, **Timeline** and **Metrics**.

## How everything works together

![How everything works together](docs/slide-images/03-how-everything-works-together.png)

One loop, for every project at once:

1. **You** approve, send back or chat.
2. **Triggers** start work on a schedule, on an event or on demand.
3. **Runs** queue up, each in its own checkout of the main line.
4. **Work** produces entities and artifacts.
5. **Summarization** turns the artifacts into cards.
6. The **consistency guard** validates the run as one transaction, then lands it.
7. The **main line** gets one commit per run.
8. The **attention feed** shows the result, ranked, unverified first, and it comes back to you.

At the centre sits the **knowledge graph**, one per project. Your own commits skip the run and the guard; your own runs start at once.

## Entities

![Entities](docs/slide-images/04-entities.png)

An **entity is its card**: one Markdown file in the `knowledge-graph` directory, held under a character limit so it fits on a phone.

- **Type = path.** The directory is the type, e.g. `knowledge-graph/Governance/Decision/private-mesh.md`. There are 151 types.
- **References** link entities to each other (`depends_on`, `implements`, `concerns`), and search walks them with Graph RAG.
- **Artifacts** are the files the entity summarizes: source code, plans, chats. A summary is the entity plus its artifacts.

## Entity types

![Entity types](docs/slide-images/05-entity-types.png)

**151 types in 12 domains**: Product, Governance, Architecture, Code, Data, Frontend, Testing, Security, Infrastructure, Organization, Knowledge and Harness. A feature, a decision, an API, a database table, a test suite, a threat, a deployment, a meeting note: each has a type, and each type has its directory at `knowledge-graph/<Domain>/<Type>/`. The full list lives in [docs/entity-types.tsv](docs/entity-types.tsv).

## Entity states

![Entity states](docs/slide-images/06-entity-states.png)

Every entity carries three independent states.

- **Verification** is your judgement: **unverified** entities wait in the feed; your approval makes them **verified**. A run that rewrites an entity makes it unverified again.
- **Sync** tracks the entity against its artifacts and implementation:
  - **synced**: card and artifacts agree.
  - **entity_ahead**: approved, not yet implemented; an implementation run follows.
  - **artifact_ahead**: an artifact changed; a summarization run follows.
  - **updating**: a run is working on it, until it lands.
- **Contradictions** count the open contradiction issues over the entity.

## Automations

![Automations](docs/slide-images/07-automations.png)

Twelve automations work around the knowledge graph: **Search**, **Exploration**, **Preparation**, **Implementation**, **Validation**, **Consistency check**, **Retention**, **Optimization**, **Summarization**, **Graph build**, **Chat** and **Interview**. Each starts on a schedule, on an event, when you ask, when a project is enabled, or from a Stop hook.

**One project, two lanes:**

- **Automation runs** queue up and run one at a time.
- **Your runs** (a chat, a send back, a run on demand) start at once, alongside them.

## Triggers

![Triggers](docs/slide-images/08-triggers.png)

A **trigger** is an entity that says when an automation runs.

- **Every two hours**, around the clock: **Exploration** on the hour, **Preparation** at half past.
- **Every night**, one after another: **Validation** at 02:00, **Consistency check** at 03:00, **Retention** at 04:00, **Optimization** at 05:00.
- **Events**: one run starts the next. An approved, unimplemented entity starts **Implementation**; a finished implementation starts **Validation**.
- **On demand**: any trigger with `on_demand: true`. Chat and Interview run on demand only.
- **No trigger entity**: **Summarization** runs from every run's Stop hook, **Graph build** runs while a project is enabled until its graph is complete, and **Search** answers in one turn, without a run.

When the feed reaches its limit, scheduled loops pause until you catch up.

## Automation management

![Automation management](docs/slide-images/09-automation-management.png)

Automations are entities too.

- The **harness workspace** holds one definition per automation; its artifacts are the Claude Code files at `automations/<name>/agents/momentum-<name>.md`.
- **Each workspace** holds one trigger per automation: schedule, events, on demand.
- Your edits land on the main line as you commit them. **Optimization** proposes changes for patterns that repeat three times across chats; they pass the consistency guard, reach the feed and are verified like any other entity.
- You can **run on demand** (also by voice), **stop a run** (what it wrote still lands), pick **models** per automation and cap **concurrent runs** in total.

## Agent tools

![Agent tools](docs/slide-images/10-agent-tools.png)

What a run's agent can use:

- **Claude Code built-in tools** (Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch, Agent, Skill, TodoWrite) in the run's own checkout.
- **momentum-kb** (MCP, in process): `search` (text, semantic, Graph RAG), `read` and `references`, `types`, `write` (validated on write) and `record_agent_metric`.
- **momentum-run** (MCP, in process): `report_graph_build` and `report_interview`, so the run reports progress to the harness.
- **Sub-agents**, such as `momentum-summarization`, from the project's `.claude/agents`.
- **Hooks**: `PostToolUse` puts the consistency guard on every write; `Stop` and `SubagentStop` summarize, fix issues and write the commit message.
- **momentum** (MCP over HTTP at `/mcp`): your voice tools. The whole API, no UI: feed, approve, send back, ask, resolve issues, run automations, settings and more.

## Summarization

![Summarization](docs/slide-images/11-summarization.png)

When a run stops, the **Stop hook** hands the run's artifacts (code, plans, chats, documents) to the **summarization sub-agent**. It turns them into **summary entities**: one card each, within the character limit, so you read one card instead of a pile of changes.

Your own commits work the same way: a changed artifact marks its entity **artifact_ahead**, a summarization run follows, and the card is rewritten.

## Graph completeness

![Graph completeness](docs/slide-images/12-graph-completeness.png)

How well is a project understood? Completeness is **the mean of two halves**:

- **Understanding**: eight questions a reader needs answered (what the product is, what it is for, what it does, how it is built, where the code is, where it runs, how it is tested, what rules and decisions shape it). Any entity of a matching type answers its question.
- **Territory**: every area of the repository accounted for. An area counts by its parts, not its files, weighted by the logarithm of its size. One card can claim a whole directory; a card per file, class or function counts for nothing.

It is **measured on the main line** by the harness, never estimated by a run. Each graph build run is told the gaps, and the build is **complete** when nothing is left that the repository can fill.

## Consistency guard

![Consistency guard](docs/slide-images/13-consistency-guard.png)

The **consistency guard** checks every write in the run's checkout: **type**, **links**, **diagram** and **references**. A run lands as one transaction and one commit on the main line. Everything lands; what fails carries an issue.

The nightly **consistency check** reads the knowledge graph only, never the artifacts. It raises a **Harness/Issue** for each finding (a contradiction, say) that **concerns** the entities involved, and the issue is counted on each of them.

## Issue types

![Issue types](docs/slide-images/14-issue-types.png)

- **By rule**, found by queries over the graph and the guard's checks:
  - **Reference**: an unresolved reference, or a card linking an entity that is not among its references.
  - **Type path**: a type outside `entity-types.tsv`, or outside its directory.
- **By reading** the cards themselves, by severity:
  - **High**: **Contradiction** (claims clash across entities), **Logical** (claims of one entity cannot all be true), **Ambiguity** (wording open to more than one reading).
  - **Medium**: **Design gap** (a missing flow, mechanism or rule), **Naming** (an unintroduced name, or two names for one concept), **Repetition** (facts restated elsewhere).
  - **Low**: **Verbose**, **Struct** (a format that hides the information), **Split** (a fragment of another entity).

**One issue per finding.** The check raises issues and never fixes them. Each issue names the entity at fault, offers 2–4 options to resolve, and scores impact and unlocks from 0 to 5.

## Issue resolution

![Issue resolution](docs/slide-images/15-issue-resolution.png)

An issue card in the feed lists the entities it concerns and the options to resolve it, the recommended one first.

- **Swipe right** to take the picked option.
- **Swipe left** to give your own resolution.
- Either way a **chat run** applies it to the concerned entities, which come back to the feed unverified, and retires the issue.
- **Won't resolve** keeps the issue, verified, with your reason in its frontmatter. It is not raised again and no longer counts as a contradiction.

## Git

![Git](docs/slide-images/16-git.png)

The **main line is the only branch**. Every run works in its own checkout and lands as one commit:

- A run on an untouched tip **fast-forwards**.
- A run whose base moved is **replayed** on the new tip. If its files changed meanwhile, it still lands and a **Harness/Conflict** reaches the feed.
- **Your chat** runs at once, alongside the queue; queued runs (validation, retention, preparation) follow one at a time.
- **Your checkout follows**: clean files are updated, dirty ones are left alone.

## User actions

![User actions](docs/slide-images/17-user-actions.png)

- **Swipe left**: send back with a comment. A chat run works on it and the card shows **updating**.
- **Swipe right**: approve. One commit on the main line; when nothing implements the entity yet, **Implementation** follows.
- Beyond the feed: **chat** to ask and steer, **run on demand** by voice, **stop a run** (what it wrote lands), **enable, build or reset projects**, **edit entities** by committing to main, and change **settings**, limits and models.

## Settings

![Settings](docs/slide-images/18-settings.png)

- **Appearance**: system, light or dark theme, per device.
- **Included projects**: enable a project to start its loops, and stop, resume or reset its knowledge graph build.
- **Feed size**: how many items before scheduled loops pause.
- **Cards**: the character limit (a card fits on a phone screen) and presentation rules.
- **Summarization**: path patterns never summarized, such as `**/*.lock`.
- **Lifetimes**: when the retention automation retires entities of each type.
- **Agents**: concurrent runs in total, across projects.
- **Models**: one model, one per automation, or **by risk** (e.g. Haiku for low-risk implementation, Sonnet for medium, Opus for high).
- **In the knowledge graph**: automations, entity types, risk rules and each project's triggers live as entities and change through the feed.

---

## Getting started

### Requirements

- **Windows** (the service scripts and run limits use PowerShell and [Process Governor](https://github.com/lowleveldesign/process-governor))
- **Node.js 24+** and **pnpm 10**
- **PostgreSQL** with the **pgvector** extension (e.g. in Docker Desktop)
- **Claude Code**, signed in: every run is a Claude Code session under your account
- **Tailscale**: the API listens only on the tailnet, so the phone reaches it over a private WireGuard mesh with no public port

### Install

```bash
pnpm install
```

Create `.env` in the repository root:

```ini
DATABASE_URL=postgres://user:password@127.0.0.1:5432/momentum
MOMENTUM_ROOT=C:\Projects        # every git repository directly under it is a workspace
MOMENTUM_HOST=127.0.0.1          # optional: development on this machine instead of the tailnet
```

Other settings, with their defaults:

| Variable | Default | Purpose |
|---|---|---|
| `MOMENTUM_PORT` | `7300` | API port |
| `MOMENTUM_RUNS` | `<root>\.runs` | Where run checkouts live |
| `MOMENTUM_RUN_MEMORY` | `4G` | Memory limit per run |
| `MOMENTUM_RUN_CPUS` | `4` | CPU cores per run |
| `MOMENTUM_TICK_MS` | `30000` | How often the orchestrator checks triggers |
| `MOMENTUM_PROCGOV` | `procgov` | Process Governor executable |

### Run

Set a password for the app, then start the back end and web app (both restart on change):

```bash
pnpm momentum generate-password
```

```bash
pnpm dev
```

Enable a project so its loops start:

```bash
pnpm momentum enable <workspace>
```

To serve Momentum at every logon, register the scheduled task once with `apps/backend/service/install.ps1`.

### CLI

| Command | What it does |
|---|---|
| `generate-password` | Writes a new password to `<root>\.momentum\password.txt` |
| `set-password [password]` | Sets the password and ends existing sessions |
| `enable` / `disable <workspace>` | Starts or stops a project's loops |
| `logo <workspace> <file \| --remove>` | Sets the project's logo |
| `index [workspace...]` | Indexes the main line afresh |
| `openapi` | Writes `packages/contract/openapi.json` |

### Test

```bash
pnpm test
```

```bash
pnpm typecheck
```

```bash
pnpm e2e
```

### Repository layout

| Path | Contents |
|---|---|
| `apps/backend` | API, orchestrator, runner and consistency guard (Fastify, Claude Agent SDK) |
| `apps/app` | The mobile and web app (Expo, React Native) |
| `packages/contract` | Typed routes shared by the app and back end, and the OpenAPI document |
| `packages/entity` | Entity parsing and validation |
| `packages/kb` | The knowledge base: Postgres index, search, embeddings, MCP tools |
| `packages/runs` | Run checkouts and process limits |
| `automations` | One Claude Code agent definition per automation |
| `knowledge-graph` | Momentum's own knowledge graph |
| `examples` | Sample projects for the end-to-end scenarios |
| `docs` | The slide deck and its sources, and the entity type list |
| `video` | The walkthrough video (Remotion) |

### Working rules

Momentum works on one straight line: no branches, no merges, in this repository and in the projects it runs. Every change is committed straight to `main`.

## License

Momentum is licensed under the [Apache License 2.0](LICENSE).
