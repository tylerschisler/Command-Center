# Codex Kickoff Prompt — Phase 0 + Phase 1

Read `AGENTS.md` and every document under `/docs` before making changes.

You are implementing **Phase 0 and Phase 1 only**.

Do not implement business features from later phases except where minimal infrastructure is strictly required.

## Objectives
1. Initialize the application using Next.js, React, and TypeScript.
2. Establish the local SQLite database.
3. Select either Prisma or Drizzle as the ORM.
4. Document the ORM choice and rationale in `docs/ARCHITECTURE.md`.
5. Create database migration infrastructure.
6. Create the base application shell and navigation for:
   - Home
   - My Work
   - Projects
   - Waiting On
   - Calendar
   - People
   - Knowledge
   - Intelligence
   - Settings
7. Create a reusable UI/design-system foundation.
8. Establish an application-service pattern.
9. Implement foundational `ActivityEvent` persistence.
10. Establish environment configuration.
11. Create `.env.example` with placeholders only.
12. Establish unit, integration, and end-to-end testing infrastructure.
13. Add error handling and application-level logging that does not expose secrets.
14. Ensure the application runs locally.
15. Ensure persisted data survives restart.
16. Ensure schema migrations can be created and applied safely.
17. Initialize Git if it is not already initialized.

## Architecture Requirements
- Primary data is local.
- Do not add a hosted database.
- Do not add cloud authentication.
- Do not implement Jarvis yet.
- Do not implement voice yet.
- Do not implement GRC news yet.
- Do not add telemetry.
- Do not give any future AI component direct database access.
- All future domain logic must flow through application services.
- All meaningful future mutations must be designed to create ActivityEvents.
- Do not create a Milestone entity.
- Preserve the future requirement for both `targetDate` and `dueDate` on Projects and Tasks, but do not implement full Task/Project feature UI until Phase 2 unless needed for schema scaffolding.
- Keep the code modular and maintainable.
- Prefer a small number of well-defined abstractions.

## Database / ORM
Choose Prisma or Drizzle based on:
- SQLite support
- TypeScript ergonomics
- migration reliability
- ease of maintenance
- compatibility with the intended local-first architecture

After choosing:
- explain the choice in `docs/ARCHITECTURE.md`
- create migration commands/scripts
- create a minimal foundational schema sufficient for Phase 1
- avoid overbuilding all future tables if doing so makes migrations harder to maintain

## ActivityEvent Foundation
Implement enough to prove:
- an ActivityEvent can be persisted
- it can be queried
- timestamps and source are stored
- the application can later use this as the immutable work history

Do not fake activity history in memory.

## Navigation / UI
Create a clean desktop-oriented shell.

The UI should:
- support keyboard navigation
- be accessible
- use reusable components
- avoid fake feature implementations
- clearly mark unfinished areas where appropriate

Do not build a generic chatbot UI.

## Tests
At minimum, verify:
- app boots
- database connects
- migration applies
- a persisted test record survives a reload/restart boundary where practical
- ActivityEvent can be written/read
- navigation renders
- service pattern can be exercised in a test
- type checks pass
- linting passes

## Security
- no secrets in code
- no secrets in Git
- no telemetry
- no cloud data persistence
- add `.gitignore` rules for:
  - `.env`
  - local database files
  - local backup files
  - generated secret material
- do not invent production encryption yet unless required for Phase 1 scaffolding; instead leave a clearly documented security hook for the encrypted-database implementation defined in `SECURITY.md`

## Finish Criteria
Before stopping:
1. Run all tests.
2. Run type checks.
3. Run linting.
4. Confirm the app launches.
5. Confirm database persistence.
6. Confirm migrations work.
7. Summarize:
   - files created/changed
   - ORM selected and why
   - architecture decisions made
   - tests run and results
   - known issues
   - deferred security work
   - recommended next step

If you discover a conflict between the requested implementation and the source-of-truth documents, stop that part of the implementation and surface the conflict instead of silently changing the architecture.
