# 05 — Utility: Personal hub (notes, todos, reminders, Gmail, Calendar)

## Goal
A daily-use personal page combining: local-only **notes**, **todos**, and **reminders**, plus read-only views into the user's **Gmail** inbox and **Google Calendar** via OAuth. Everything lives behind a single sidebar entry with internal tabs.

## Why
Constant context-switching to other apps to jot a note, capture a todo, check today's events, or scan unread email. One page, one design language, zero telemetry, owned by the user.

## Why this respects "local-only"
- **Notes / todos / reminders** are 100% local (Postgres + browser).
- **Gmail / Calendar** call **Google's APIs only**, with the user's own OAuth credentials stored locally (encrypted in DB; key in `backend/.env`).
- No third-party server is involved. Same trust model as installing Apple Mail.
- Both Google integrations are **opt-in**: the utility works fully without any account connected.

## Scope by phase

| Phase | Deliverable                                                      | Needs from user |
|-------|------------------------------------------------------------------|-----------------|
| 1     | Notes CRUD (create/edit/archive/search/tag)                      | nothing         |
| 2     | Todos CRUD (with due_at, completion, tags)                       | nothing         |
| 3     | Reminders (frontend polling + browser Notifications API)         | grant browser permission |
| 4     | Gmail read (inbox list, open message, disconnect)                | GCP project + OAuth client |
| 5     | Google Calendar read (today + week)                              | same OAuth client (incremental scope) |

Each phase ships independently. Phases 4 and 5 share the OAuth scaffolding.

## Inputs / Outputs

### Notes
- **Input:** title (≤200), body (markdown, ≤50,000 chars), tags (≤10).
- **Output:** list, full-text search, edit, archive (soft delete).

### Todos
- **Input:** title, optional body, optional `due_at`, tags, optional `remind_at`.
- **Output:** list filtered by status (open/done) and tag, sorted by due, then recency.

### Reminders
- **Input:** linked todo + `remind_at`.
- **Output:** unified "Due now" panel; browser Notification when fired.

### Gmail (read-only)
- **Input:** OAuth credential.
- **Output:** inbox list (subject, from, snippet, unread flag); open message body (sanitized HTML).

### Calendar (read-only)
- **Input:** OAuth credential.
- **Output:** today's events; 7-day week ahead.

## Functional requirements

### F-Notes
- F1. Create / edit / delete notes with markdown body.
- F2. Tag-based filter; full-text search across title + body (Postgres FTS via `SearchVector`).
- F3. Archive (soft delete) instead of hard delete; archived notes hidden by default.
- F4. Stable sort: pinned first (future), then `updated_at` desc.

### F-Todos
- F5. Create / edit / delete todos.
- F6. Toggle complete; completed group collapsed by default.
- F7. Optional `due_at`; overdue items visually flagged.
- F8. Bulk complete + bulk delete (multi-select).

### F-Reminders
- F9. Reminder = a todo with `remind_at`. May be earlier than `due_at` or absent altogether.
- F10. Frontend polls `/api/personal-hub/due?within=300` every 60s while tab is open.
- F11. When a reminder fires, post a browser Notification (if permission granted) and visually highlight in-page.
- F12. Per-firing actions: "Snooze 10m" (push `remind_at` +10m), "Mark done" (set `completed_at`), "Dismiss" (clear `remind_at`).
- F13. Server marks `last_fired_at` on emit so a re-poll doesn't re-fire the same reminder twice.

### F-Gmail
- F14. "Connect Gmail" → OAuth consent (scope: `gmail.readonly`).
- F15. Inbox list (last 50 messages, paginate with cursor).
- F16. Open message: subject, from, date, **sanitized** HTML body.
- F17. "Disconnect" deletes the locally-stored credential.
- F18. Failed refresh shows an inline banner asking the user to reconnect; does not break notes / todos.

### F-Calendar
- F19. "Connect Calendar" → OAuth consent (scope: `calendar.readonly`).
- F20. Today panel: events sorted by start time (local TZ).
- F21. Week panel: 7-day grouped list.
- F22. Per-event row: title, start–end (formatted in user's locale TZ), location, attendee count, link to Google Calendar.

## Non-functional
- NF1. Reuses existing Postgres + Redis — no new infra.
- NF2. Reminder polling adds ≤1 req / minute / open tab; trivial cost.
- NF3. OAuth tokens **encrypted at rest** with `cryptography.fernet.Fernet`. Encryption key in `PERSONAL_HUB_ENC_KEY` env var.
- NF4. All Gmail HTML is sanitized server-side via `bleach` before reaching the frontend.
- NF5. All times stored as UTC; rendered in browser's local TZ via `Intl.DateTimeFormat`.
- NF6. p95 latency for any Notes/Todos endpoint < 100ms locally.

## BDD Scenarios

```gherkin
Feature: Notes CRUD

  Scenario: Create a note
    Given the user is on the Personal hub Notes tab
    When the user submits a note with title "groceries" and body "milk\nbread"
    Then the note appears at the top of the list
    And the response status is 201

  Scenario: Search notes
    Given notes "shopping list", "weekend plans", "recipe ideas" exist
    When the user searches for "weekend"
    Then only "weekend plans" is shown

  Scenario: Update a note
    Given a note "draft" with body "v1"
    When the user updates the body to "v2"
    Then the response status is 200
    And the note body is "v2"

  Scenario: Archive hides the note
    Given a note "draft thoughts" exists
    When the user archives it
    Then it disappears from the active list
    And it appears under "Archived"

  Scenario: Delete a note
    Given a note exists
    When the user deletes it
    Then the response status is 204
    And the note is no longer in the list

  Scenario: Reject body over the size limit
    When the user submits a note with a body of 50001 characters
    Then the response status is 400

Feature: Todos lifecycle

  Scenario: Create with due date
    When the user adds a todo "review PR" with due_at in 2 hours
    Then it appears in "Today" sorted before items due later

  Scenario: Overdue flag
    Given a todo with due_at in the past and status "open"
    Then the todo is marked as overdue

  Scenario: Complete and undo
    Given a todo "buy milk" exists
    When the user marks it complete
    Then the todo moves to the completed group
    When the user un-completes it
    Then the todo returns to the open group

  Scenario: Reject negative duration
    When the user submits a todo with remind_at after due_at
    Then the response status is 400

Feature: Reminders fire when due

  Scenario: Server returns due reminders within window
    Given a todo with remind_at 60s from now
    When the client polls /due?within=300
    Then the response includes that todo
    And last_fired_at is set on the server

  Scenario: Repeated polls do not re-fire the same reminder
    Given a reminder has already fired this minute
    When the client polls /due again immediately
    Then the response does not include that reminder

  Scenario: Snooze pushes remind_at
    Given a fired reminder
    When the client snoozes it by 10 minutes
    Then remind_at is updated to now + 10 minutes
    And last_fired_at is cleared

Feature: Gmail OAuth and read

  Scenario: Connect flow stores a credential
    Given Gmail is not connected
    When the user completes the Google consent
    Then an OAuthCredential row exists for provider "google"
    And the inbox list returns successfully

  Scenario: Disconnect revokes locally
    Given Gmail is connected
    When the user clicks Disconnect
    Then the OAuthCredential row is deleted
    And the inbox section shows "Not connected"

  Scenario: Token refresh fails gracefully
    Given an expired refresh token
    When the inbox is fetched
    Then the response status is 401
    And the response error code is "reauth_required"

  Scenario: Render an HTML message body
    Given a Gmail message with HTML body containing a script tag
    When the message is opened
    Then the rendered body has the script tag stripped
    And the visible content is preserved

Feature: Calendar today and week

  Scenario: Today shows events sorted by start
    Given Calendar is connected
    And there are 2 events scheduled today
    When the Today panel loads
    Then both events appear sorted by start time
    And times are rendered in the user's local TZ

  Scenario: Empty day
    Given no events exist for today
    Then the Today panel shows "Nothing scheduled"

  Scenario: Week panel groups events by day
    Given 5 events spread across the next 7 days
    When the Week panel loads
    Then events are grouped under their date heading
```

## Out of scope (v1)
- **Sending email** (write scope), composing, replying, archiving, labeling.
- **Creating / editing calendar events** (write scope).
- **Service worker / push notifications** for reminders when tab is closed.
- **Recurring todos** with RRULE — only one-shot `remind_at` for v1.
- iCloud, Outlook, Yahoo integrations.
- Voice notes, file attachments, image inlining.
- Sharing notes / todos with another user.
- Note encryption client-side (notes are stored plaintext in local Postgres).

## Tech notes

### Backend
- New Django app `utilities/personal_hub/`.
- Models:
  - `Note(id, title, body, tags ArrayField, archived_at, search_vector, created_at, updated_at)`
  - `Todo(id, title, body, due_at?, remind_at?, last_fired_at?, completed_at?, tags ArrayField, created_at, updated_at)`
  - `OAuthCredential(provider, refresh_token_enc bytea, access_token_enc bytea, expires_at, scopes, granted_at, revoked_at?)` — singleton per provider for now.
- Endpoints:
  - `GET/POST /api/personal-hub/notes`, `GET/PATCH/DELETE /api/personal-hub/notes/<id>`
  - `GET/POST /api/personal-hub/todos`, `GET/PATCH/DELETE /api/personal-hub/todos/<id>`
  - `GET /api/personal-hub/due?within=300` → reminders firing within next N seconds
  - `POST /api/personal-hub/todos/<id>/snooze` `{ minutes }`
  - `GET /api/personal-hub/oauth/google/start` → 302 to consent
  - `GET /api/personal-hub/oauth/google/callback`
  - `POST /api/personal-hub/oauth/google/disconnect`
  - `GET /api/personal-hub/gmail/inbox?cursor=...`
  - `GET /api/personal-hub/gmail/messages/<id>`
  - `GET /api/personal-hub/calendar/today`
  - `GET /api/personal-hub/calendar/week`
- Libs to add: `google-auth`, `google-auth-oauthlib`, `google-api-python-client`, `cryptography`, `bleach`, `markdown` (already implicitly via DRF? — no, add explicitly if backend renders).
- DRF ModelViewSets for Notes / Todos. Custom APIViews for `/due`, `/snooze`, OAuth, Gmail, Calendar.
- Postgres FTS via `SearchVector` + GIN index; updated via Django signal on save.
- Polling-based reminders — no Celery, no scheduler.

### Frontend
- New route `/personal-hub` with internal tabs in search params: `?tab=notes|todos|mail|calendar` (default `notes`).
- TanStack Query for all server state. Optimistic updates on note / todo writes.
- Markdown render via `markdown-it` (already installed).
- Browser **Notifications API** for reminder firing; permission requested on tab open the first time, gracefully handles "denied".
- Reuses the engineer-terminal design language: monospace headings, serif body, amber accent, dark surfaces.

### OAuth (one-time per machine)
1. User creates a project at `console.cloud.google.com`.
2. Enables Gmail API and Google Calendar API.
3. Creates an OAuth 2.0 client (type "Web application"), adds redirect URI `http://localhost:8000/api/personal-hub/oauth/google/callback`.
4. Drops `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` into `backend/.env`.
5. Generates an encryption key once: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` → put in `PERSONAL_HUB_ENC_KEY`.
6. README has a dedicated "Personal hub setup" section with the above steps.

## Risks / open questions

- **Browser Notifications need an open tab.** Documented as a v1 limitation. Service-worker push is a v2 stretch.
- **Gmail HTML sanitization** is the highest-risk area for a hidden XSS. Use `bleach` server-side AND DOMPurify client-side (defense in depth). Strip `<script>`, event handlers, `javascript:` URIs, and external `<link>` / `<style>`.
- **OAuth scopes drift over time** — start with `gmail.readonly` and `calendar.readonly`. If we ever need write, document the consent re-prompt.
- **Token-refresh recovery flow** must surface inline (banner on the affected tab) instead of failing the whole utility. Notes / todos must keep working when Google is unavailable.
- **TZ handling**: store all DB times as UTC; render in browser's local TZ. Calendar API returns events in their original TZ — convert to user's TZ in frontend, label the source TZ on hover.
- **Multiple-tab double-firing** of reminders — `last_fired_at` on the server prevents the same reminder from being returned twice within the cooldown window.
- **Encryption key loss** = user must reconnect Google. Acceptable; document.
- **Bleach can over-strip rich HTML** (legit `<style>` blocks in marketing emails). Tradeoff is fine — readability is secondary to safety.
- **Postgres FTS in Spanish + English** — use the `simple` dictionary for v1 to avoid stemming surprises across languages; revisit if search quality is poor.
