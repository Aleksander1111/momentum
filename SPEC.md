# Momentum harness

## Purpose

- Boosts the performance of the work done around a project
- The orchestrator and single entry point between the user and that work, for any project in any workspace
- A consistent, concise layer over whatever lies underneath, so a project is explored through entities instead of raw artifacts

## Dictionary

- **API**: Entry point between the front-end and the agents
- **Approved state**: The system itself; approval makes a change part of it, and anything unapproved sits outside the project
- **Attention feed**: A single feed where everything that needs the user's attention shows up; its items are entities, of any type
- **Automation**: A background loop, per project, defined by its responsibility alone
- **Attention ranking**: The feed order, derived from the entities themselves by impact on the product, impact on the timeline, and how much the work unlocks
- **Card**: The concise representation of an entity, the same for every flavour: title, description, bullet points, table, diagram, within fixed limits
- **Chat tool**: Asks a question or steers a run directly, without waiting for the feed
- **Consistency guard**: Reacts to every change in the knowledge base, groups related changes into a transaction and validates them before they land on the main line
- **Dedicated machine**: The one resource-rich machine that runs the back-end, the agents and the knowledge base
- **Enabled project**: A project the orchestrator schedules; a disabled project has no loops running for it
- **Entity**: The unit of the knowledge base, shown as a card; standalone, with a type, an origin and a state
- **Entity type**: A path; all entities of the same type share a directory
- **Front-end**: One app, written once and deployed to both web and mobile
- **Goal**: An entity in a workspace's knowledge base that guides exploration
- **Harness**: The orchestrator and single entry point between the user and the work around a project
- **Index and metrics database**: The queryable side of the knowledge base: indices over entities, automations and chats, plus the metrics collected about them
- **Knowledge base**: Graph RAG over many different entity types, one per workspace
- **Layers**: Attention (ranked feed, approval), understanding (entities, index), implementation (automations, runs, validation)
- **Lifetime**: How long an entity earns its place on the main line, set by rules per entity type
- **Main line**: Where a change counts, once the guard has validated it and the user has approved it
- **Origin**: How an entity came to be: added by the user, requested by the user and written by an automation, or raised by an automation on its own
- **Orchestrator**: Starts and supervises the background automation loops, per project
- **Run**: One Claude Code process per run and per project, in its own checkout of the project repository, on its own branch
- **Summary**: The flavour of entity that has underlying artifacts, written by summarization; shown as the same card as any other entity
- **Transaction**: A group of related changes the consistency guard validates together
- **Workspace**: A project; a git repository on the dedicated machine, with its own knowledge base

## Success criteria

The harness earns its place only if it boosts the user's performance instead of costing attention.

- Consistency grows across every project it touches
- Work arrives as one consistent piece, not as fragments the user has to assemble
- The system is flexible enough that it does not need constant modification to keep working

## Workspaces and projects

A project is a workspace, and a workspace is a git repository on the dedicated machine; all workspaces sit side by side under one root directory. Nothing is registered elsewhere; what lives on disk is what the system works on.

- Each workspace carries its own knowledge base, built on the same entity structure
- Goals are entities in that knowledge base, so the automations read them the same way they read everything else
- Goals arrive by every route: written in the chat tool, edited directly as entities, or proposed by an automation for the user to approve
- The harness manages itself: its own repository is one of the workspaces, with its own goals and knowledge base
- Single user by design: a workspace is never shared
- Projects stay isolated: no entities, findings or knowledge cross from one workspace into another
- Between 5 and 20 projects are expected to be enabled at once, with their loops running in parallel

## Components

Three layers carry the user: attention on top, understanding beneath it, implementation at the base.

![Harness and products](slides/slide-1.png)

The same three layers, cut by the workspaces they run in: the attention layer is shared; everything beneath it exists once per project.

### Front-end

- One app, written once and deployed to both web and mobile
- Three ways into a project: the attention feed, a separate chat tool, and direct exploration of the entity layer
- The chat tool asks a question or steers a run directly, without waiting for the feed
- The entity layer is browsable and searchable on its own: the user walks the project card by card, or explores it through an agent

![Mobile app](slides/slide-2.png)

### Back-end

#### API

- Entry point between the front-end and the agents
- The front-end polls for new feed items and for the results of long-running runs; no persistent push channel, as changes are infrequent enough for polling

#### Orchestrator

Starts and supervises the background automation loops, per project. It ships in the same application as the API: one back-end deployable, with only the runs as separate processes.

- Owns the schedule and lifecycle of every loop run, triggered on time or on demand
- The feed size bounds the loops: they keep producing until the feed reaches its limit, then pause until the user works it down
- Only enabled projects are scheduled: a disabled project falls out of the orchestrator's control entirely, and no loops run for it
- Every run is a separate process: one Claude Code process per run and per project
- Each run process works in its own checkout of the project repository, on its own branch, so concurrent runs never share a working tree
- Runs are isolated and killable, with their own resource limits; a crashing or heavy run cannot take the orchestrator down
- Concurrency is configurable: several runs may be active for one project, bounded by the Anthropic API limits and tuned from measured behaviour rather than fixed upfront

#### Knowledge base

- Graph RAG over many different entity types
- The full list of entity types lives in a separate document: [Entity types](entity-types.tsv)
- The unit is the entity; it is standalone and needs no artifact behind it
- A summary is a flavour of entity: an entity with underlying artifacts, written by summarization
- Entities arrive by three origins: added by the user directly, requested by the user and written by an automation, or raised by an automation on its own; every origin reaches the main line through the feed
- Every entity is shown as a card, described the same way whatever its flavour, within fixed limits:
  - One title, at most 40 characters
  - One paragraph of description
  - Up to seven bullet points
  - One table, at most seven columns and seven rows
  - One diagram
- An entity that cannot be fully described within these limits is split into several entities that reference each other
- Entities live on disk in a file structure that mirrors their types: a type is a path, so all entities of the same type share a directory
- Chats are resources: each is stored and indexed as a summary, with the chat as its artifact
- Actions are entities as well, so failures, conflicts and resolutions reach the attention feed by the same path as everything else
- Agents and automations read and write the knowledge base freely on their own branch; nothing gates work in progress
- The gate is at the main line: a change counts only once the guard has validated it and the user has approved it
- No separate ingestion component: the automations read the sources themselves, and summarization turns repository artifacts into summaries

##### Consistency guard

Reacts to every change in the knowledge base so it stays consistent at all times, despite free access.

- Groups related changes into a transaction and validates them before they land on the main line
- Validation covers the card limits and the references between entities
- Changes that cannot be made consistent are raised as issues, the same way the consistency check loop reports them
- Runs on every change, not only on the scheduled consistency check
- Updates the index and metrics database as part of every validated transaction

##### Index and metrics database

The queryable side of the knowledge base: indices over entities, automations and chats, plus the metrics collected about them.

- Lives alongside the entities: each workspace carries its own store next to its files, not a separate managed service
- Kept up to date by the consistency guard, on every change
- Holds four families of metrics, each tracked over time so trends are visible, and all of them fed to the optimization automation:
  - Attention: time the user spends per item, what is approved, rejected or sent back, and the patterns regular enough to become automatic approval or rejection
  - Understanding: how consistent the knowledge base is and how that consistency moves
  - Agents: misalignments found in chats, issues that recur, and how the automations behave run over run
  - Implementation: the state of the project itself: outstanding issues, bugs and defects
- Tracks cost continuously: spend is known at any moment, with consumption estimated on a rolling 5-hour and weekly basis
- Holds the attention ranking, computed as the indices are updated; the API reads the ranking and the feed order straight from it, with no work per poll

#### Automations

Automations run continuously in the background, per project, independently of the user, preparing work ahead of time.

No entity type belongs to an automation. Each automation is defined by its responsibility alone and searches the whole knowledge base across every layer, picking whatever entities serve that responsibility.

AI is not the default. Each responsibility is split into steps and every step is carried by the cheapest mechanism that can carry it: indices, metrics, lifetimes and references are queries and rules, not prompts. AI is reserved for the judgement that cannot be expressed that way — deciding, planning, reviewing, summarizing.

- Exploration
  - Decides the next best action for the project
  - Researches and collects the information needed for that decision
  - Is guided by the workspace's goals and works within them rather than setting them
  - A project whose goals are all met goes idle
- Preparation
  - Finds tasks, issues, research and other action points that can be started
  - Prepares plans for the user to accept
  - Plans are summaries too, so they stay short and quick to read and approve
- Consistency check
  - Runs as a background loop and on demand
  - Checks consistency across all entities in the knowledge base
  - Reports several kinds of issues, each raised as its own entity for the user to react to
- Retention
  - Every entity has a lifetime: a task resolved a month ago or research long since delivered no longer earns its place on the main line
  - Rules per entity type rather than a fixed TTL: what counts as spent depends on the type and on what still references it
  - Runs as a background loop that proposes what to retire, and the removal reaches the approved state through the feed like any other change
- Implementation
  - A regular Claude Code automation/chat
  - Work lands on its own branch, never on the main line directly
  - The branch is merged automatically once validation passes
- Validation
  - Validates the product, not only the change: an implementation change triggers a run, and a background loop validates the project as it stands
  - The background runs are regression and exploratory testing, so defects surface without a change to prompt them
  - The form depends on the work: a review of the changes, a test suite run, an exploratory pass, or a consistency check
  - Gates the merge: only a verified branch is merged back, and a failed validation raises an issue entity that holds the branch until it is resolved
  - A branch that cannot be merged raises a conflict or merge resolution entity, carrying its own priority and waiting for the user's approval
- Optimization
  - Analyzes chats for misalignments with the user and issues that came up
  - Finds resolutions for the issues that recur most often: skills, sub-agents, definitions, new tools or MCP servers
  - Owns the Claude Code definitions and automations
  - Definitions, skills and sub-agents belong to the harness repository, so their behaviour can be measured across every project
  - Each variant is materialized into the workspaces that use it, so Claude Code picks it up locally with no indirection
  - Competing implementations of a skill or sub-agent are compared on the collected metrics
- Summarization
  - Summarizes artifacts from the repository: chats, plans, results implemented by AI
  - Runs as a step inside the other automations, so none of them is limited by how much it can read
  - Writes each summary before the user reads the work
  - Each summary is a card like any other entity, a separate markdown document, at `knowledge-graph/type/sub-type/parent-name/name`
  - Output shape: an easy-to-read tree; tables allowed but kept small
- Chat
  - The direct chat is an automation too, started by the user instead of by the schedule
  - Runs on the same machinery as every other automation: its own process, checkout and branch
  - Can do anything the other automations can; its results reach the approved state through the feed like any other change

#### Attention feed

A single feed where everything that needs the user's attention shows up.

- The user verifies, approves or sends back each item; a reaction takes any form the item needs: a change request, a split into several entities, or new entities alongside it
- Nothing changes unattended: every change surfaces as an entity, a summary of an artifact, a feature, a result, and passes the user's eyes before it counts
- The approved state is the system: approval is what makes a change part of it, and anything unapproved sits outside the project
- Items are entities, of any type
- One feed across projects: projects are enabled or disabled on demand and the feed adjusts to the enabled set
- Ranking answers one question: what should be done right now so the product ends up the best it can be and the journey there stays optimal
- A few parameters decide it, each measuring how much the work behind the entity matters: impact on the product, impact on the timeline, and how much it unlocks
- So a prioritized feature request, an optimization that compounds into future work, a refactoring that cannot wait and a pending exploration compete on the same scale
- No project priority: ranking is derived from the entities themselves, not from a rank assigned to a workspace

## Database

Tables of the [index and metrics database](#index-and-metrics-database), one store per workspace, updated by the consistency guard on every validated transaction.

### entity

| Field | Description |
|---|---|
| path | Location on disk, `knowledge-graph/type/sub-type/parent-name/name` |
| type | Entity type; the directory shared by all entities of that type |
| title | Title, at most 40 characters |
| description | One paragraph of description |
| origin | user, requested or automation |
| feed_state | verified, unverified or pending_update |

An entity with at least one row in `entity_artifact` is a summary; there is no flavour column.

### entity_artifact

| Field | Description |
|---|---|
| entity_path | Summary written from the artifact |
| artifact_path | Repository artifact behind the summary, such as a chat, a plan or a result implemented by AI |

### entity_reference

| Field | Description |
|---|---|
| from_path | Entity holding the reference |
| to_path | Entity referenced; validated by the guard, read by retention to decide what is spent |
| relation_type | Type of relation between the two entities |

### chat

| Field | Description |
|---|---|
| entity_path | Summary the chat is stored and indexed as; the chat is its artifact |
| run_id | Chat automation run the chat belongs to |

### automation

| Field | Description |
|---|---|
| name | Exploration, preparation, consistency check, retention, implementation, validation, optimization, summarization or chat |
| responsibility | Responsibility that defines the automation |

### run

| Field | Description |
|---|---|
| id | One Claude Code process per run and per project |
| automation | Automation the run belongs to |
| branch | Own branch of the run |
| checkout | Own checkout of the project repository |
| trigger | On time or on demand |

### attention_ranking

| Field | Description |
|---|---|
| entity_path | Entity in the feed |
| product_impact | Impact on the product |
| timeline_impact | Impact on the timeline |
| unlocks | How much the work unlocks |
| rank | Feed order, read by the API with no work per poll |

### attention_metric

| Field | Description |
|---|---|
| entity_path | Feed item |
| time_spent | Time the user spends on the item |
| reaction | Approved, rejected or sent back |
| recorded_at | Time of measurement |

### attention_pattern

| Field | Description |
|---|---|
| pattern | Reaction pattern regular enough to automate |
| outcome | Automatic approval or rejection |

### understanding_metric

| Field | Description |
|---|---|
| consistency | How consistent the knowledge base is |
| recorded_at | Time of measurement |

### agent_metric

| Field | Description |
|---|---|
| run_id | Run measured, for comparison run over run |
| misalignments | Misalignments with the user found in chats |
| recurring_issues | Issues that recur |
| variant | Skill or sub-agent variant in use, for comparing competing implementations |
| cost | Spend of the run; rolling 5-hour and weekly estimates are computed from it on read |
| recorded_at | Time of measurement |

### implementation_metric

| Field | Description |
|---|---|
| outstanding_issues | Outstanding issues |
| bugs | Bugs |
| defects | Defects |
| recorded_at | Time of measurement |

## Implementation

No stack is fixed. The choice is driven by constraints, not by a preferred technology. The infrastructure is built in one pass rather than delivered as incremental slices.

- The back-end runs Claude Code as a first-class citizen: its automations, definitions and tooling are native to the runtime, not wrapped around it
- Every capability is reachable through the user's voice tools, so the system can be driven without the UI

### Deployment

- Self-hosted: the back-end, the agents and the knowledge base run on one dedicated, resource-rich machine
- No cloud services; nothing is offloaded to a managed runtime
- The web and mobile clients connect to that machine over the network

#### Remote access

No port is exposed to the public internet. Clients reach the machine through a private mesh network (WireGuard, e.g. via Tailscale), so the API listens only on that network's interface.

- Each device is enrolled once and carries its own key; a lost device is revoked centrally
- Traffic is encrypted end to end by the tunnel; the API additionally requires a per-user session
- No inbound firewall rule, no reverse proxy on the public edge, no shared secret in the clients

## Open questions

- How a workspace is added or retired
- Whether any dedicated agents are needed beyond the automations
- Which form validation takes for each kind of work
- How the attention ranking is tuned and measured
- How the knowledge base stays in sync with its sources (repositories, issues, chats)
- The integration surface with Claude Code: skills, sub-agents, tools and MCP servers
- Scale, latency and cost targets, and what the mobile app does offline
