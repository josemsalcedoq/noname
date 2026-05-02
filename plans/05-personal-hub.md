# 05 — Utility: Personal hub (notes, todos, reminders)

## Goal
A daily-use personal page combining local-only **notes**, **todos**, and **reminders** behind a single sidebar entry with internal tabs. 100% local — no third-party APIs.

> **Earlier draft included Gmail and Google Calendar.** Those scopes were dropped because they pull the project away from its local-only premise and add OAuth setup friction that doesn't fit the "free, single-user, runs on my laptop" charter. If we ever want them back, this plan can be revived as a separate utility.

## Why
Constant context-switching to other apps to jot a note, capture a todo, or check what's coming up today. One page, one design language, zero telemetry.

## Scope by phase

| Phase | Deliverable                                                                | Status |
|-------|----------------------------------------------------------------------------|--------|
| 1     | Notes CRUD (create / edit / archive / search / tag)                        | done   |
| 2     | Todos CRUD (with `due_at`, completion, tags)                               | done   |
| 3     | Reminders (frontend polling + browser Notifications API)                   | done   |
| 4     | Markdown render in notes (`markdown-it` reused from dev-tools)             | done   |
| 5     | Bookmarks tab (URL + title + notes + tags + search + archive)              | done   |

Each phase ships independently. There is no Phase 4+; if we want richer features later (recurring todos, attachments, sharing) they come as separate plans.

## Inputs / Outputs

### Notes
- **Input:** title (≤200), body (markdown, ≤50,000 chars), tags (≤10).
- **Output:** list, full-text search, edit, archive (soft delete).

### Todos
- **Input:** title, optional body, optional `due_at`, tags, optional `remind_at`.
- **Output:** list filtered by status (open/done) and tag, sorted by due then recency.

### Reminders
- **Input:** linked todo + `remind_at`.
- **Output:** unified "Due now" panel; browser Notification when fired.

## Functional requirements

### F-Notes
- F1. Create / edit / delete notes with markdown body.
- F2. Tag-based filter; full-text search across title + body (Postgres `icontains` for v1, FTS later if needed).
- F3. Archive (soft delete) instead of hard delete; archived notes hidden by default.

### F-Todos
- F4. Create / edit / delete todos.
- F5. Toggle complete; completed group filtered by `?status=done`.
- F6. Optional `due_at`; overdue items visually flagged.

### F-Reminders
- F7. Reminder = a todo with `remind_at`. May be earlier than `due_at` or absent altogether.
- F8. Frontend polls `/api/personal-hub/due?within=300` every 60s while tab is open.
- F9. When a reminder fires, post a browser Notification (if permission granted) and visually highlight in-page.
- F10. Per-firing actions: "Snooze 10m" (push `remind_at` +10m, clear `last_fired_at`), "Mark done" (set `completed_at`), "Dismiss" (clear `remind_at`).
- F11. Server marks `last_fired_at` on emit so a re-poll within the cooldown window doesn't re-fire the same reminder.

## Non-functional
- NF1. Reuses existing Postgres + Redis — no new infra.
- NF2. Reminder polling adds ≤1 req / minute / open tab; trivial cost.
- NF3. p95 latency for any Notes/Todos endpoint < 100ms locally.

## BDD Scenarios

```gherkin
Feature: Notes CRUD

  Scenario: Create a note
    When the client posts a note with title "groceries" and body "milk\nbread"
    Then the response status is 201
    And the note list contains a note with title "groceries"

  Scenario: Reject body over the size limit
    When the client posts a note with title "x" and a body of 50001 characters
    Then the response status is 400

  Scenario: Reject more than 10 tags
    When the client posts a note with title "x" and 11 tags
    Then the response status is 400

  Scenario: Search notes by title
    Given notes exist with titles "shopping list", "weekend plans", "recipe ideas"
    When the client searches notes for "weekend"
    Then the search response has 1 entry
    And the search response contains a note with title "weekend plans"

  Scenario: Archive hides the note
    Given a note "draft" exists
    When the client archives it
    Then the active note list is empty
    And the archived note list has 1 entry

  Scenario: Delete a note
    Given a note "ephemeral" exists
    When the client deletes it
    Then the response status is 204

Feature: Todos lifecycle

  Scenario: Create an open todo
    When the client posts a todo with title "review PR"
    Then the response status is 201
    And the open todo list contains a todo with title "review PR"

  Scenario: Reject remind_at after due_at
    When the client posts a todo where remind_at is later than due_at
    Then the response status is 400

  Scenario: Complete moves todo to done
    Given a todo "buy milk" exists
    When the client completes it
    Then the open todo list is empty
    And the done todo list has 1 entry

  Scenario: Reopen brings todo back to open
    Given a completed todo "buy milk" exists
    When the client reopens it
    Then the open todo list has 1 entry

  Scenario: Snooze pushes remind_at by N minutes
    Given a todo "stretch" with remind_at 1 minute from now
    When the client snoozes the todo for 10 minutes
    Then the todo's remind_at is more than 10 minutes from now

Feature: Reminders polling

  Scenario: Returns todos with remind_at within window
    Given a todo "ping" with remind_at 30 seconds from now
    When the client polls due reminders within 300 seconds
    Then the response includes "ping"

  Scenario: Cooldown prevents double-firing
    Given a reminder has fired in the last cooldown window
    When the client polls again
    Then the response is empty

  Scenario: Completed todos are excluded
    Given a completed todo has remind_at 30 seconds from now
    When the client polls due reminders within 300 seconds
    Then the response is empty
```

## Out of scope (v1)
- Recurring todos with RRULE (only one-shot `remind_at`).
- Service worker / push notifications when tab is closed.
- Voice notes, file attachments, image inlining.
- Sharing notes / todos with another user.
- Encryption at rest (notes/todos stored plaintext in local Postgres — single-user box).
- Any external integrations (mail, calendar, drive). Removed by user decision.

## Tech notes

### Backend
- New Django app `utilities/personal_hub/`.
- Models:
  - `Note(id, title, body, tags ArrayField, archived_at, created_at, updated_at)`
  - `Todo(id, title, body, tags ArrayField, due_at?, remind_at?, last_fired_at?, completed_at?, created_at, updated_at)`
- Endpoints:
  - `GET/POST /api/personal-hub/notes`, `GET/PATCH/DELETE /api/personal-hub/notes/<id>`
  - `POST /api/personal-hub/notes/<id>/archive` and `/unarchive`
  - `GET/POST /api/personal-hub/todos`, `GET/PATCH/DELETE /api/personal-hub/todos/<id>`
  - `POST /api/personal-hub/todos/<id>/complete` and `/reopen`
  - `POST /api/personal-hub/todos/<id>/snooze` `{ minutes }`
  - `GET /api/personal-hub/due?within=300`
- DRF ModelViewSets for Notes/Todos.
- Polling-based reminders — no Celery, no scheduler.

### Frontend
- New route `/personal-hub` with internal tabs in search params: `?tab=notes|todos` (default `notes`).
- TanStack Query for all server state. Optimistic invalidation on note/todo writes.
- Markdown render via `markdown-it` (already installed).
- Browser **Notifications API** for reminder firing; permission requested on first reminder due.
- Reuses the engineer-terminal design language.

## Risks / open questions
- **Browser Notifications need an open tab.** Documented as a v1 limitation. Service-worker push is out of scope.
- **Multiple-tab double-firing** of reminders — `last_fired_at` on the server prevents the same reminder from being returned twice within the cooldown window.
- **TZ handling**: store all DB times as UTC; render in browser's local TZ via `Intl.DateTimeFormat`.
