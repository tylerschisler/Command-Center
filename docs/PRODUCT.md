# Product Requirements — Command Center

## Product Vision
Command Center is a local-first, AI-assisted work operating system for a GRC analyst and project manager.

It should always help answer:
1. What do I need to do?
2. What am I waiting on?
3. What is happening across my projects?
4. What do I need to know?

The core philosophy is:

> Tell the system what is happening; the system organizes, tracks, remembers, and surfaces what matters.

## Primary User
A single user managing:
- personal work tasks
- delegated tasks
- recurring work
- projects
- requests / dependencies
- meetings
- notes
- knowledge
- briefings
- public GRC intelligence

## V1 Core Modules
- Command Center / Home
- My Work
- Projects
- Waiting On
- Calendar
- Meetings
- People
- Knowledge Library
- Intelligence
- Jarvis
- Activity history
- Briefings
- Settings
- Backup / restore
- Global search
- Quick capture

## Tasks
Tasks may be owned by the user or another person.

Required concepts:
- title
- description
- status
- priority
- owner
- project (optional)
- start date
- target date
- due date
- completion date
- recurrence
- notes
- activity history

Suggested statuses:
- Not Started
- In Progress
- Waiting
- Blocked
- Completed

Suggested priorities:
- Critical
- High
- Medium
- Low

## Projects
Projects represent meaningful bodies of work.

Required concepts:
- name
- description
- owner
- status
- health
- priority
- start date
- target date
- due date
- completion date
- tasks
- requests
- meetings
- notes
- knowledge relationships
- people relationships
- activity

Suggested project statuses:
- Planning
- Active
- On Hold
- Completed
- Cancelled

Suggested project health:
- On Track
- At Risk
- Off Track

V1 intentionally does not use milestones.

## Requests / Waiting On
A Request represents something another person owes or is expected to provide.

Suggested statuses:
- Draft
- Requested
- Acknowledged
- Waiting
- Received
- Closed

Required concepts:
- title
- description
- requested-from person
- project (optional)
- related task (optional)
- requested date
- due date
- follow-up date
- received date
- closed date
- priority
- notes
- activity

## People
People are lightweight work contacts, not a full CRM.

People screens should emphasize:
- open tasks
- open requests
- related projects
- meetings
- notes

Do not show "last interaction" as a primary V1 metric.

## Meetings
Meetings are manually created in the product for V1.

Required concepts:
- title
- date/time
- attendees
- agenda
- notes
- project
- status
- related tasks
- related requests
- decisions

Meeting action items must become Tasks or Requests.

### Meeting Mode
A focused meeting experience should support:
- agenda
- live notes
- quick note
- quick task
- quick request
- voice capture through Jarvis
- end meeting

Continuous full-meeting recording/transcription is not required for V1.

## Knowledge Library
The Knowledge Library uses a hybrid approach:
- user can manually create/edit pages
- Jarvis can create, update, search, and organize knowledge

Knowledge pages:
- can belong to multiple topics
- can have multiple tags
- may relate to projects, people, applications, meetings, or other pages
- maintain version history
- distinguish contextual notes from reusable knowledge

Example:
A single "Galileo" page may belong to:
- Applications
- User Access Reviews
- Access Control

It may contain sections for both:
- what the application does
- UAR-specific procedures

## Notes
A Note is contextual.
A Knowledge Page is reusable knowledge.

Jarvis may suggest promoting a contextual note into the Knowledge Library.

## Calendar
Calendar is a view over:
- meetings
- task target dates
- task due dates
- project target dates
- project due dates
- request due dates
- request follow-up dates

V1 views:
- Day
- Week
- Month
- Agenda

## Jarvis
Jarvis is the integrated AI operating layer of the product.

Jarvis should:
- accept typed and spoken instructions
- navigate the product
- retrieve data
- perform controlled actions
- explain results
- speak responses aloud
- generate visual outputs in the Jarvis Workspace

Jarvis should not feel like a website chatbot.

### Response Levels
1. Ambient response
   - quick confirmation
   - visual update
   - optional short spoken response

2. Action Summary
   - compact explanation of multi-step changes
   - links to affected items

3. Jarvis Workspace
   - substantial visual output
   - project analysis
   - meeting preparation
   - knowledge synthesis
   - daily / weekly briefings
   - custom analysis

## Briefings
### Morning Briefing
Forward-looking:
- today’s tasks
- overdue work
- meetings
- follow-ups
- project risks
- recommended focus
- relevant GRC intelligence

### End-of-Day Briefing
Backward + forward:
- accomplishments
- completed tasks
- project movement
- requests sent/received
- meetings
- decisions
- knowledge captured
- outstanding work
- tomorrow priorities

### Weekly Review
Higher-level:
- major accomplishments
- project progress
- dependencies
- risks
- completed work
- next week priorities

Briefings are persisted in a Briefing Library.

## GRC Intelligence
Use public internet sources to surface a small number of high-relevance stories.

Topics may include:
- GRC
- cybersecurity
- third-party risk
- banking regulation
- NIST
- CISA
- OCC
- FDIC
- FFIEC
- Federal Reserve
- SEC
- AI governance
- significant breaches

Every intelligence item must retain:
- headline
- publication date
- original source
- source URL
- summary
- relevance
- why it matters

## Focus
Home should help the user decide what matters, not simply list everything.

Jarvis may recommend priorities based on:
- due date
- target date
- overdue state
- project health
- blocked dependencies
- waiting time
- meeting schedule
- task priority
- workload

## Quick Capture
Support fast capture through:
- keyboard
- text
- voice

An Inbox concept may hold uncategorized captured items until processed.

## V1 Non-Goals
- enterprise multi-user collaboration
- corporate email integration
- corporate calendar integration
- full GRC control-management platform
- automatic meeting recording/transcription
- mobile app
- team permissions
- cloud-hosted primary database
