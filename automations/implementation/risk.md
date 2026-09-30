# Implementation risk

How hard the implementation is. Take the highest level any rule gives; when no rule fits, medium.

## High

- Data at rest: migrations, schema, table or stored procedure changes, backfills (Data/Migration, Data/Schema, Data/DbTable, Data/StoredProcedure)
- Security: authentication, authorisation, roles, permissions, secrets, certificates, encryption (Security/*, Code/SecretReference)
- A contract others depend on: API, endpoint, event, command or shared type changes (Architecture/Api, Architecture/Endpoint, Architecture/Contract, Architecture/Event, Architecture/Command)
- Concurrency and recovery: queues, locks, retries, scheduled jobs, process handling, restart recovery (Architecture/Queue, Infrastructure/ScheduledJob, Architecture/StateMachine)
- Infrastructure and delivery: deployments, CI/CD, environments, networking, backups (Infrastructure/*)
- Work across more than one service, package or bounded context
- A plan of more than 8 steps
- Open questions, unknowns or research still to do in the entity or its plan
- Nothing in the repository to follow: a new library, framework, integration or vendor (Architecture/Integration, Architecture/Dependency)

## Medium

- A feature, user story or bug fix within one service or package, following an existing pattern (Product/Feature, Product/UserStory, Product/Bug)
- Back-end logic with existing tests around it
- A screen, form or route with new state, navigation or data fetching (Frontend/Screen, Frontend/Form, Frontend/Route)
- Tech debt or refactoring confined to one package (Product/TechDebt)
- A plan of 4 to 8 steps

## Low

- Copy, localization strings, notification templates, docs, comments (Frontend/LocalizationString, Frontend/NotificationTemplate, Knowledge/*)
- Styling and design tokens (Frontend/DesignToken, Frontend/UiComponent without new state)
- Configuration values and feature flags with no new code paths (Code/ConfigSetting, Code/FeatureFlag)
- Tests only (Testing/*)
- A bug with a known cause and a fix of a few lines in one file
- A plan of 1 to 3 steps touching one file or component
