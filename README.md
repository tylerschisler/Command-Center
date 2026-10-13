# Command Center

Local-first personal productivity and project-management software. Phase 6 provides manual Task, Project, Person, Request, Meeting, Calendar, and Knowledge workflows plus a deterministic Command Center and persisted Morning, End-of-Day, and Weekly briefings. Data remains in encrypted SQLite with versioned knowledge, local search, and durable activity history.

## Local setup

Requirements: Node.js 24+ and npm.

```sh
cp .env.example .env
npm install
npm run db:encrypt
npm run db:migrate
npm run recovery:init
npm run dev
```

`recovery:init` displays a recovery credential once. Save it offline or in a trusted password manager, separately from the Mac and its backups. Do not paste it into `.env` or save it in the repository. Open `http://localhost:3000`. The default database is stored at `./data/command-center.db`; it is ignored by Git and survives process restarts.

`My Work` supports All, Mine, Delegated, Today, Upcoming, and Completed views. `Projects` provides project creation/editing, overview metrics, associated tasks, and activity. Target dates are planned dates; due dates are required deadlines. They are never adjusted automatically, and the UI warns when target is later than due.

`People` manages lightweight work contacts and derives their open delegated Tasks, outstanding Requests, and related Projects. `Waiting On` tracks what another Person owes, with All, Overdue, Due Soon, Follow-Up Needed, and Received views. Legacy anonymous Phase 2 delegated owners remain visible as unresolved until a real Person is selected; they are never silently assigned.

`Calendar` provides Month, Week, Day, and Agenda projections over Meetings and existing Task, Project, and Request dates. Meeting Mode supports attendees, live notes, decisions, quick Tasks, quick Requests, and explicit start/end actions. Calendar records are never duplicated into a separate event table.

`Knowledge` is a local Markdown library with explicit saves, multi-topic membership, normalized Tags, content version history, archive/restore, SQLite FTS5 search, and manual relationships to Projects, People, Meetings, and other Knowledge Pages. Saving changed content creates a new immutable version; typing alone does not create versions or ActivityEvents.

`Home` derives concise daily metrics, ranked attention, work, dependencies, meetings, project health, and Focus recommendations from persisted local data. Ranking is deterministic and displays its reasons. Morning, End-of-Day, and Weekly briefings persist both traceable structured facts and a human-readable local rendering; Phase 6 uses no AI or cloud dependency. Generation is manual, and regenerating preserves prior briefing snapshots.

## Commands

- `npm run db:generate` creates a migration after a schema change. Review the generated SQL before committing it.
- `npm run db:migrate` safely applies pending versioned migrations.
- `npm run db:encrypt` initializes encrypted storage or safely converts a Phase 1 plaintext database while preserving its predecessor.
- `npm run backup:create -- [optional-path]` creates a manual authenticated encrypted backup.
- `npm run backup:validate -- <path>` authenticates, decrypts, opens, and integrity-checks a backup.
- `npm run backup:restore -- <path> --confirm` restores after protecting the active database; the confirmation flag is mandatory.
- `npm run recovery:init` creates protected recovery material and displays the new credential once.
- `npm run recovery:verify` prompts without echoing and verifies the credential against the active encrypted database.
- `npm run recovery:restore-keychain` prompts for the credential, verifies the active database, and recreates the missing Keychain item.
- `npm run recovery:restore-keychain -- <backup-path>` reconstructs Keychain from a recovery-enabled backup after fully validating that backup.
- `npm run recovery:rotate` verifies the current credential, rewraps the unchanged database key, and displays a replacement credential once. Create a new backup immediately; old backups still require their old credential.
- `npm run test` runs unit tests.
- `npm run test:integration` applies migrations to a temporary on-disk database and verifies persistence across reopened connections.
- `npm run test:e2e` boots the application and tests navigation in Chromium.
- `npm run typecheck`, `npm run lint`, and `npm run build` perform static and production checks.

## Recovery and moving to a new Mac

Keep two things in separate safe locations: at least one validated `.ccbackup` file and the `CCREC1...` recovery credential that existed when that backup was created. The `.ccrecovery` file contains only protected key material and is included in new backups; it does not contain the credential.

To recover on the same Mac after a Keychain item is lost, run `npm run recovery:restore-keychain` and enter the credential at the hidden prompt. To move using only a backup, install Command Center on the new Mac, copy the backup locally, run `npm run recovery:restore-keychain -- /path/to/backup.ccbackup`, then run `npm run backup:restore -- /path/to/backup.ccbackup --confirm`. Neither operation creates a plaintext database.

If both the Keychain entry and the recovery credential are lost, the active database and encrypted backups cannot be recovered. Credential rotation does not rewrite old backups, so keep the prior credential until backups made under it have been intentionally retired.

Encrypted `pre-encryption` copies are created only during explicit database conversion. Encrypted `pre-restore` copies are created immediately before an authenticated backup replaces the active database. They can be deleted once the active database is verified and a separate backup has been validated. Successful operations automatically keep only the three newest copies of each type; Phase 9 will add full retention and backup-management workflows.

Do not implement later roadmap phases without first reviewing `AGENTS.md` and every file in `docs/`.
