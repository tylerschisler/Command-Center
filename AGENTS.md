# AGENTS.md

## Project
Command Center is a local-first personal productivity and project-management application for a GRC analyst / project manager. It combines projects, tasks, requests, meetings, people, knowledge, briefings, and an integrated AI assistant ("Jarvis").

## Source of Truth
Before making changes, read:
- `docs/PRODUCT.md`
- `docs/DATA_MODEL.md`
- `docs/UX.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/ROADMAP.md`

If implementation conflicts with these documents, do not silently improvise. Surface the conflict and propose the smallest compliant resolution.

## Core Rules
1. This is a local-first application.
2. Primary application data must remain local.
3. Jarvis must never directly query or modify the database.
4. All business logic must go through application services.
5. All meaningful data mutations must create an `ActivityEvent`.
6. Destructive operations require explicit confirmation.
7. Bulk AI actions must support undo or recovery where practical.
8. Never hard-code secrets, tokens, or API keys.
9. Use environment variables or secure local secret storage for credentials.
10. No telemetry or analytics unless explicitly approved.
11. Every schema change requires a migration.
12. New business logic requires tests.
13. Do not change documented architecture without approval.
14. Prefer maintainable, boring solutions over clever abstractions.
15. UI components should be reusable and accessible.
16. Keyboard navigation is required for core workflows.
17. Cloud AI receives only the minimum context necessary for a request.
18. Backup data must be encrypted before leaving the active database location.
19. Do not implement features from later roadmap phases unless current-phase infrastructure requires them.
20. The product must remain useful even if AI services are unavailable.

## AI / Jarvis Rules
- Jarvis is integrated into the product, not a generic website chatbot.
- Jarvis operates through explicit application tools/actions.
- Jarvis may read context relevant to a request but should not receive the entire database by default.
- Jarvis may create/update low-risk records with visible confirmation and undo when practical.
- Jarvis must request confirmation before destructive or high-impact actions.
- Jarvis must not execute arbitrary SQL.
- Jarvis outputs substantial results in the Jarvis Workspace rather than a chat sidebar.
- Voice input/output must use provider abstractions so vendors/models can be changed later.
- Briefings must be built from structured application facts first; AI only summarizes those facts.

## Data Rules
- Projects and Tasks each have both a `targetDate` and `dueDate`.
- A target date is the expected/planned completion date.
- A due date is the committed/required deadline.
- Target dates may be before or after due dates.
- If target date is after due date, surface that risk visibly.
- V1 does not use project milestones.
- Tasks and Requests are separate:
  - Task = work someone must perform.
  - Request = something being requested / awaited from another person.
- Knowledge pages may belong to multiple topics and tags.
- Knowledge pages maintain version history.
- Calendar is a view over time-based records, not a duplicate calendar table.
- Meeting action items become Tasks or Requests.
- Activity history is deterministic and persisted.

## Security Rules
- Primary database is local and encrypted.
- Backups are automatic, encrypted, restorable, and retention-controlled.
- API keys must not be stored in source control.
- No corporate email/calendar integration is assumed for V1.
- Sensitive data should not be sent to cloud AI unless explicitly allowed by user configuration.
- The application must be able to run with cloud AI disabled.

## Testing Rules
At minimum:
- Unit tests for service/business logic.
- Integration tests for persistence + activity logging.
- End-to-end tests for core user workflows.
- Later Jarvis behavior tests for intent-to-action correctness.
- Backup restore tests must verify actual recovery, not only backup file creation.

## Git / Change Discipline
- Keep changes scoped to the requested phase.
- Use clear commits/checkpoints.
- Do not rewrite unrelated code.
- Before finishing a phase:
  - run tests
  - run type checks
  - run linting
  - document known issues
  - summarize changed files
  - recommend the next smallest step

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
