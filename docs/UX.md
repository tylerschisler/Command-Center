# UX Architecture — V1

## Primary Navigation
- Home
- My Work
- Projects
- Waiting On
- Calendar
- People
- Knowledge
- Intelligence
- Settings

Global controls:
- Search
- Quick Add
- Jarvis / Voice

## Design Principle
Jarvis is integrated into the product. It should not feel like a generic website chatbot.

The UI should support:
- traditional navigation
- keyboard-first workflows
- quick capture
- natural-language commands
- voice
- contextual AI actions
- substantial outputs in the Jarvis Workspace

## Home / Command Center
Purpose:
Answer "What deserves my attention?"

Show:
- due today
- meetings today
- waiting items
- projects at risk
- Morning Briefing
- Today's Work
- Attention Needed
- Waiting On
- Today's Meetings
- Project Health
- GRC Intelligence
- Jarvis Focus recommendations

Cards should be actionable and navigable.

Phase 6 implements Home as an executive operating surface rather than a generic chart dashboard. Five compact metrics lead into capped Today’s Work, Attention Needed, Waiting On, Today’s Meetings, Project Health, and five-item Focus sections. Each recommendation shows its deterministic reason, and rows link to the owning workspace. Empty sections state which rule found no records. Briefing actions and the persisted library live on Home; an accessible side drawer shows the fact-derived rendering and explicitly identifies that no AI was used.

## My Work
Primary views:
- All
- Mine
- Delegated
- Today
- Upcoming
- Recurring
- Completed

Task list should prominently show:
- title
- owner
- target date
- due date
- status
- priority
- project

Selecting a task should preferably open a fast detail surface without unnecessary navigation.

## Projects
Landing page:
- active count
- at-risk count
- off-track count
- filters
- search
- progress

Project list columns:
- name
- health
- target date
- due date
- progress

Project detail:
- Overview
- Tasks
- Waiting On
- Meetings
- Notes
- Activity

Overview:
- health
- status
- priority
- target
- due
- progress
- open tasks
- overdue tasks
- requests
- attention items
- next actions

## Waiting On
Show:
- all
- overdue
- due soon
- follow-up needed
- received

Request detail:
- requested from
- project
- requested date
- due date
- follow-up date
- status
- timeline
- mark received
- record follow-up

## Calendar
Views:
- Month
- Week
- Day
- Agenda

Render:
- meetings
- task targets
- task due dates
- project targets
- project due dates
- request due dates
- follow-up dates

Use clear visual distinctions by event type.

Phase 4 implements all four views with Meeting, Target, Due, and Follow-Up labels and entity-specific visual treatments. Selecting a Meeting opens its detail and Meeting Mode in context; selecting other projected records navigates to their owning workspace. Calendar navigation changes the visible Month, Week, or Day without creating records.

## Meetings
Meeting detail:
- title
- date/time
- attendees
- project
- agenda
- notes
- tasks
- requests
- decisions

### Meeting Mode
Focused in-meeting view:
- agenda
- live notes
- quick note
- quick task
- quick request
- voice capture
- end meeting

V1 voice capture should support user-directed notes, not continuous full-meeting recording.

Phase 4 Meeting Mode is fully manual: start/end lifecycle controls, editable live notes, attendee management, decisions, quick Tasks, and quick Requests. Voice and AI controls remain absent until their later phases.

## People
People list should show:
- name
- open tasks
- open requests
- active projects

Person detail:
- Tasks
- Waiting On
- Projects
- Meetings
- Notes

Do not emphasize last interaction in V1.

## Knowledge
Hybrid manual + AI experience.

A page may belong to multiple Topics.

Example:
Galileo
- Topic: Application
- Topic: User Access Review
- Topic: Access Control

Knowledge page:
- title
- topics
- tags
- content
- related knowledge
- related projects
- related people
- version history
- AI-assisted add/update/search actions

The user must be able to manually edit everything without AI.

Phase 5 implements a manual-first Knowledge workspace with All Pages, Topics, Tags, and Archived views; local search; explicit Markdown editing; taxonomy assignment; related entities/pages; and inspectable version history. One page appears in every assigned Topic without duplication. Explicit Save creates a version only when content changes, and restoring a version creates a new saved state. Project, Person, and Meeting detail surfaces show lightweight related-Knowledge sections without redesigning their primary workflows.

## Intelligence
Executive-briefing style, not a news feed.

Each story:
- relevance
- headline
- summary
- why it matters
- potential impact
- source
- save to knowledge

Home should generally surface only 1–3 top stories.

## Jarvis Interaction Model
### Ambient
For quick actions:
- subtle listening state
- app updates directly
- short visual confirmation
- optional short spoken response

### Action Summary
For multi-step actions:
- compact summary of changes
- affected items
- links
- undo where practical

### Jarvis Workspace
For substantial outputs:
- Morning Briefing
- End-of-Day Briefing
- Weekly Review
- Project analysis
- Meeting preparation
- Knowledge synthesis
- Custom analysis

The Workspace is not a chat sidebar.
It is a dynamic output canvas.

It may contain a follow-up input at the bottom:
- text
- voice
- contextual follow-up

## Jarvis Voice
Jarvis should support:
- push-to-talk
- spoken confirmations
- spoken summaries
- spoken briefings
- configurable voice behavior

Suggested settings:
- Voice Responses
- Speak Confirmations
- Speak Briefings
- Speak Long Responses
- Push-to-Talk Shortcut

## Quick Add
Keyboard-first and voice-friendly.

Examples:
- "Review SOC report Friday"
- "Follow up with Sarah tomorrow about Galileo"
- "Meeting with GRC team Thursday 2 PM"

System should show interpretation before creation when ambiguity is meaningful.

## Inbox
Optional lightweight capture buffer:
- holds uncategorized items
- Jarvis may suggest how to classify them

## Search
Global search across:
- Tasks
- Projects
- Requests
- People
- Meetings
- Notes
- Knowledge
- Activity

## Briefings
### Morning
Forward-looking.

### End of Day
Accomplishments + changes + tomorrow.

### Weekly
Major work, project progress, risks, dependencies, next week.

Briefings should be persisted and searchable.

Phase 6 supports explicit Morning, End-of-Day, and Weekly generation. Regeneration preserves the prior record as a separate snapshot. Morning is current and forward-looking; EOD and Weekly use ActivityEvents for accomplishments and changes, current records for outstanding risk, and current future dates for tomorrow or next week. Full global Briefing search and AI narrative remain later work.

## Important UX Rule
The product should always provide a normal manual path for every critical workflow. AI must not be required to use core features.

# Phase 7 Jarvis interaction

Jarvis is entered from the global `Ask Jarvis…` control or `⌘J`. The surface is a command palette that expands into a structured document workspace, never a chat transcript. Simple single mutations use an ambient confirmation, multiple successful mutations use an action summary with entity links, and analysis uses reusable heading, metric, reference, warning, recommendation, and briefing blocks. Follow-ups stay within the active browser session.

When a Project or Knowledge Page is explicitly open, its typed ID and label—not page HTML—are passed as context. Ambiguity produces a clarification instead of a guessed mutation. Navigation is limited to known destinations and local validated entity IDs. Cloud AI settings clearly explain data egress and preserve all manual functionality when disabled.

# Phase 8 Voice interaction

The Jarvis workspace includes a Hold to talk control rather than a chat-style audio timeline. Pointer users press and release the control; keyboard users focus it and hold Space or Enter. The interface moves through Idle, Listening, Processing speech, Thinking / executing, Speaking, and Error states. `⌘J` continues to open typed Jarvis.

The ephemeral transcript is shown as “Heard” so the user can understand what entered the normal Jarvis pipeline. The visual structured result remains authoritative. Short confirmations may play automatically; briefing speech is opt-in; long Workspace responses default to Ask and expose a separate Speak summary button. The application never automatically reads the full Workspace.

Settings expose Voice Enabled, Speech to Text, Voice Responses, Speak Confirmations, Speak Briefings, Speak Long Responses (Ask/On/Off), automatic spoken-response length, and an optional monthly transcription warning. STT and TTS can be disabled independently. Disabled or failed voice controls always leave typed Jarvis and manual product workflows available.

An in-progress Meeting shows Voice command. Opening it supplies only the explicit Meeting ID/label as Jarvis context; spoken notes, decisions, Tasks, and Requests use the same controlled tools as typed commands. Meeting Mode does not record continuously.

# Phase 9 V1 operations experience

Intelligence is an executive brief: the first three relevant recent items receive visual emphasis, while Topic, Freshness, and Relevance filters reduce the view. Every card shows original-source attribution/date/link, bounded summary, deterministic Why it matters, topics, and an explicit Save to Knowledge action. Empty state never invents stories.

Settings adds Encrypted Backups and AI Usage. Backup state shows due/last/next status, primary and optional secondary folders, the 14/8/12 policy, manual creation, validation, and recent history. Restore is nested behind disclosure, explanation, and typed `RESTORE` confirmation. No key or recovery credential appears.

AI Usage distinguishes requests, tokens, STT minutes, TTS characters, known estimates, and unknown-priced usage. Warning and cutoff amounts are editable in USD, but values are stored as integer micros. Cutoff messaging explicitly directs the user to still-available manual workflows.

# V1.1 visual and destructive-action system

The application uses one dark command-center token system: `#080B10` background, `#0F141C` primary surface, `#151B24` elevation, `#263241` border, `#3B82F6` primary blue, `#22D3EE` restrained accent, and accessible semantic success/warning/danger colors. Sidebar active state combines color, a left indicator, and `aria-current`; cards, tables, forms, drawers, Meeting Mode, Knowledge, Intelligence, and the Jarvis workspace share the same surfaces, focus rings, spacing, and status treatment.

Permanent deletion lives in a three-dot action menu and never replaces the normal primary action. The modal is an `alertdialog`, moves focus to the confirmation field, traps Tab/Shift+Tab, closes with Escape, requires typing `DELETE`, and distinguishes danger visually without relying on color alone. Project, Person, Meeting, and Knowledge confirmations explain relationship impact. Narrow layouts collapse grids while preserving keyboard access and readable contrast; reduced-motion preferences disable transitions.
