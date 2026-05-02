# 06 — Utility: Skills catalog (browse + install Anthropic skills)

## Goal
A page that lists the skills published in `github.com/anthropics/skills`, shows what's installed locally under `~/.claude/skills/`, and lets the user install or uninstall any of them with one click — plus a copy-to-clipboard "manual install" snippet for use on other machines.

## Why
Right now installing a skill means manually doing a `git clone --depth 1 --filter=blob:none --sparse …`, then `git sparse-checkout set …`, then `cp -R …`. Tedious, easy to fat-finger. We already proved the mechanic works (we used it in this session to install `frontend-design`).

## Inputs / Outputs

### Catalog
- **Input:** none (HTTP GET).
- **Output:** array of `{ name, description, license, html_url, skill_md_url, installed: bool, install_path: string|null }`.

### Install
- **Input:** skill name (path param).
- **Output:** updated entry, status `201`.

### Uninstall
- **Input:** skill name.
- **Output:** status `204`.

### Manual install steps (autocopy)
- **Input:** skill name.
- **Output:** `{ name, steps: string[], oneliner: string }`. Frontend exposes a "copy" button.

## Functional requirements
- F1. Catalog reads the public Anthropic skills repo dynamically (no hardcoded list — new skills appear automatically).
- F2. The list of folders is taken from `repos/anthropics/skills/contents/skills` (GitHub API, unauthenticated). Each `SKILL.md` is fetched from `raw.githubusercontent.com` and the YAML frontmatter parsed.
- F3. Catalog response is cached for 1 hour (Redis). Manual refresh via `?refresh=true`.
- F4. Install does a sparse-clone of just `skills/<name>/` and copies the folder to `~/.claude/skills/<name>/`. Idempotent: re-installing overwrites.
- F5. Uninstall validates the resolved path is inside `~/.claude/skills/`; refuses anything else. Then `shutil.rmtree`.
- F6. Manual install endpoint returns the exact bash commands; frontend offers copy-to-clipboard.
- F7. The skill name must match `^[a-z0-9_-]+$`. Anything else returns 400 (defensive against path traversal).

## Non-functional
- NF1. No GitHub auth required → respect rate limits (60/h). Cache mitigates.
- NF2. Network failures (GitHub down) → endpoint returns the last cached catalog with a stale flag, never 500s on transient hiccups.
- NF3. Install runs `git` as a subprocess; reuse the existing path / shell idioms.
- NF4. The skills directory is configurable via the `SKILLS_DIR` env var (default `~/.claude/skills`).

## BDD Scenarios

```gherkin
Feature: Skills catalog

  Scenario: Catalog lists all Anthropic skills with installed status
    Given the upstream catalog has skills "frontend-design" and "claude-api"
    And "frontend-design" is installed locally
    When the client fetches the catalog
    Then the response status is 200
    And the entry "frontend-design" is marked installed
    And the entry "claude-api" is marked not installed

  Scenario: Cache hit returns the cached payload
    Given the catalog is cached
    When the client fetches the catalog
    Then no upstream HTTP call is made

  Scenario: Manual refresh bypasses the cache
    Given the catalog is cached
    When the client fetches the catalog with refresh=true
    Then an upstream HTTP call is made

Feature: Install and uninstall

  Scenario: Install creates the skill folder
    Given the skill "frontend-design" exists upstream
    And it is not installed locally
    When the client installs it
    Then the response status is 201
    And the folder ~/.claude/skills/frontend-design exists

  Scenario: Reinstall is idempotent
    Given "frontend-design" is installed locally
    When the client installs it again
    Then the response status is 201

  Scenario: Uninstall removes the folder
    Given "frontend-design" is installed locally
    When the client uninstalls it
    Then the response status is 204
    And the folder ~/.claude/skills/frontend-design does not exist

  Scenario: Reject malicious skill names
    When the client installs a skill named "../etc"
    Then the response status is 400
    And the response error code is "invalid_name"

Feature: Copy install steps

  Scenario: Returns idempotent shell snippet
    When the client requests install steps for "frontend-design"
    Then the response steps include a sparse-checkout command
    And the response steps include a copy into ~/.claude/skills/

  Scenario: Reject malicious skill names in steps too
    When the client requests install steps for "..weird"
    Then the response status is 400
```

## Out of scope (v1)
- Installing skills from non-Anthropic repos (generic git URL). Phase 2.
- Editing local skills.
- Showing skill version / changelog.
- Auto-update for installed skills.

## Tech notes

### Backend
- Django app `utilities/skills_catalog/`.
- Endpoints (no models — all state is filesystem + remote):
  - `GET /api/skills/catalog?refresh=false`
  - `POST /api/skills/installed/<name>` (install, idempotent)
  - `DELETE /api/skills/installed/<name>` (uninstall)
  - `GET /api/skills/install-steps/<name>` (returns `{ name, steps, oneliner }`)
- Libs: `requests` (already transitively present via argostranslate; declared explicitly).
- Django cache (Redis) for the catalog payload — TTL 3600s.
- `subprocess.run(["git", ...])` for sparse-clone. Validates name regex first.
- `SKILLS_DIR` setting; defaults to `Path.home() / ".claude" / "skills"`.

### Frontend
- Route `/skills` with grid of cards.
- TanStack Query: `useCatalog`, `useInstall`, `useUninstall`, `useInstallSteps`.
- Each card shows: name (mono), description (serif), badge "installed" / "not installed", install / uninstall button, "copy steps" button that toggles a code block with the shell snippet and a clipboard icon.
- Search / filter by name (client-side).
- Sidebar entry under "Personal" or new section "Claude".

## Risks / open questions
- **GitHub rate limit** on catalog refresh. Cache (1h) keeps daily usage ≤24 fetches, well under 60/h.
- **Path traversal**: enforce regex on `<name>` in URL and re-validate the resolved Path is inside `SKILLS_DIR` before any write.
- **Frontmatter parsing**: simple regex parser handles the common case (single-line key:value). Multi-line YAML scalars (`|`, `>`) are ignored — acceptable for v1.
- **Skill removal**: confirm modal? For single-user local, no — skills are tiny and re-installable. Just do it.
- **Concurrent installs** of the same skill: serialize via a per-name lock or accept "last write wins" (acceptable; idempotent overwrite).
