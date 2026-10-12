# Command Center

Local-first personal productivity and project-management software. Phase 1 provides the application shell, local SQLite persistence, migration workflow, application-service boundary, and durable activity-event foundation.

## Local setup

Requirements: Node.js 24+ and npm.

```sh
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. The default database is stored at `./data/command-center.db`; it is ignored by Git and survives process restarts.

## Commands

- `npm run db:generate` creates a migration after a schema change. Review the generated SQL before committing it.
- `npm run db:migrate` safely applies pending versioned migrations.
- `npm run test` runs unit tests.
- `npm run test:integration` applies migrations to a temporary on-disk database and verifies persistence across reopened connections.
- `npm run test:e2e` boots the application and tests navigation in Chromium.
- `npm run typecheck`, `npm run lint`, and `npm run build` perform static and production checks.

Do not implement later roadmap phases without first reviewing `AGENTS.md` and every file in `docs/`.
