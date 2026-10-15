# Command Center

Local-first personal productivity and project-management software. V1 provides manual Task, Project, Person, Request, Meeting, Calendar, Knowledge, GRC Intelligence, deterministic briefings, controlled text Jarvis, optional push-to-talk voice, and encrypted backup/recovery operations. Primary data remains in encrypted SQLite with local search and durable activity history.

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

`Jarvis` opens with `⌘J` (or the top-bar button) as an integrated command/workspace surface. Cloud AI is off by default and can be enabled under Settings after `OPENAI_API_KEY` and `OPENAI_MODEL` are configured server-side. Jarvis uses an explicit, validated tool allowlist that calls application services; destructive, bulk, filesystem, database, backup, shell, and arbitrary-network tools are not exposed. Prompts and responses are short-lived and are not persisted. Local usage records contain provider/model, timestamps, request counts, and tokens only.

Voice Jarvis uses short push-to-talk recordings, not an always-on or realtime session. Configure `OPENAI_STT_MODEL` and `OPENAI_TTS_MODEL` server-side, enable Cloud AI and Voice under Settings, then press and hold the microphone control. The initial cost-efficient choices are `gpt-4o-mini-transcribe` and `gpt-4o-mini-tts`; model selection remains environment-driven. Raw audio and transcripts are not persisted or logged. TTS is optional, summarizes the visual result, and cannot invalidate a completed action. In Meeting Mode, Voice command opens Jarvis with the selected Meeting as explicit context.

## V1 Operations

### GRC Intelligence

Open **Intelligence** and choose **Refresh sources**. V1 reads reviewed public RSS/Atom feeds from CISA, NIST, and SEC, ranks recent items deterministically, and stores only bounded summaries and provenance. Every item links to its original source. **Save to Knowledge** stores the summary, source metadata, and optional user notes through the existing Knowledge service; it does not copy the full article.

To replace the reviewed defaults, set `INTELLIGENCE_SOURCES_JSON` to a JSON array of `{ "name", "feedUrl", "priority", "defaultTopics" }` records. URLs must be public HTTP(S); configuration is limited to 20 sources. Retrieved content is untrusted text and cannot invoke Jarvis or write application data automatically.

### Automatic backups and restore

Automatic encrypted backups are enabled by default. Shortly after the application opens, Command Center checks whether the newest validated managed backup is at least 24 hours old. If overdue, it creates and validates a `CCBACKUP1` archive. The computer does not need to be awake at a particular time. Settings → Encrypted Backups provides Backup Now, validation, optional secondary-folder copying, history, and restore.

Retention keeps the newest backup for 14 distinct days, then 8 additional ISO weeks, then 12 additional months. Failed-validation files are preserved for investigation, the newest known-good archive is always retained, and cleanup is restricted to managed backup directories and filenames. Secondary folders may be inside iCloud Drive, OneDrive, Dropbox, or an external drive; Command Center uses the folder only and integrates with no provider API. Secondary failure does not invalidate a valid primary backup.

Restore is destructive and requires selecting a managed archive and typing `RESTORE`. Command Center authenticates and integrity-checks the archive, protects the current encrypted database, activates and verifies the restored image, and rolls back if verification fails. `npm run db:migrate` creates a validated encrypted migration restore point before changing an existing database.

### AI usage and cost controls

Settings → AI Usage shows monthly Jarvis requests, token counts, STT minutes, TTS usage, and cost estimates from versioned pricing configuration. Unknown model prices display as Unknown and are not treated as free. Optional warning and cutoff amounts use USD. The hard cutoff pauses Jarvis, STT, and TTS only; every local manual workflow and deterministic briefing remains available.

`OPENAI_SIMPLE_MODEL` reserves a lower-cost routing target for future use. V1 never silently switches models. Pricing estimates do not affect record integrity or local features.

### Offline and network behavior

Tasks, Projects, Requests, Meetings, People, Calendar, Knowledge, FTS5 search, deterministic briefings, database encryption, and local-folder backup/restore work without the internet. Network access is limited to explicitly enabled OpenAI Jarvis/STT/TTS calls and manual GRC Intelligence refreshes. Command Center includes no telemetry.

### Security checks and known limitations

Run `npm run security:secrets` before release commits. The production dependency audit is currently clean; advisory paths remain in development-only lint/migration tooling and are documented in `docs/SECURITY.md`. V1 does not schedule at a fixed background time when the app is closed, directly integrate cloud-drive APIs, provide full article ingestion, automate disaster recovery, or support mobile/team features.

### V1.1 behavior

Home is the `/` Command Center route and supports direct load, refresh, mouse, and keyboard navigation. Jarvis settings are normalized in the browser so typed Jarvis remains available when Voice is disabled, unconfigured, loading, legacy-shaped, or temporarily unavailable.

Tasks, Requests, Meetings, Projects, People, and Knowledge Pages offer permanent deletion from their overflow actions. The dialog requires typing `DELETE`. Projects preserve and detach related work; People with any Task or Request assignment must be reassigned before deletion; Knowledge cleanup includes versions, taxonomy links, relationships, and FTS. Encrypted backups are intentionally unaffected and age out through the existing retention policy.

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
- `npm run security:secrets` checks tracked files for prohibited secret/database/backup material and recognizable credentials.
- `npm run jarvis:schema-audit` validates every strict OpenAI function schema.
- `npm run typecheck`, `npm run lint`, and `npm run build` perform static and production checks.

## Recovery and moving to a new Mac

Keep two things in separate safe locations: at least one validated `.ccbackup` file and the `CCREC1...` recovery credential that existed when that backup was created. The `.ccrecovery` file contains only protected key material and is included in new backups; it does not contain the credential.

To recover on the same Mac after a Keychain item is lost, run `npm run recovery:restore-keychain` and enter the credential at the hidden prompt. To move using only a backup, install Command Center on the new Mac, copy the backup locally, run `npm run recovery:restore-keychain -- /path/to/backup.ccbackup`, then run `npm run backup:restore -- /path/to/backup.ccbackup --confirm`. Neither operation creates a plaintext database.

If both the Keychain entry and the recovery credential are lost, the active database and encrypted backups cannot be recovered. Credential rotation does not rewrite old backups, so keep the prior credential until backups made under it have been intentionally retired.

Encrypted `pre-encryption` copies are created only during explicit database conversion. Encrypted `pre-restore` copies are created immediately before an authenticated backup replaces the active database. They can be deleted once the active database is verified and a separate backup has been validated. Successful conversion/restore operations keep only the three newest protected copies of each type. Managed backup archives additionally follow the 14 daily / 8 weekly / 12 monthly policy.

Do not implement later roadmap phases without first reviewing `AGENTS.md` and every file in `docs/`.
