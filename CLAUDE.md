# Project rules — noname

Personal utilities hub. Stack, layout, and per-utility specs live in `plans/` (start at `plans/00-overview.md`; full implementation roadmap in `plans/IMPLEMENTATION.md`). These rules cover *how* code is written, not *what* is built.

## Language
- **All code, identifiers, file names, comments, and committed documentation are in English.** This includes commit messages, plan files, READMEs, and inline strings. User-facing UI strings can be localized later if a utility needs it; everything in the repo defaults to English.

## Code quality
- **No unnecessary comments.** Default to none. Add a comment only when the *why* is non-obvious — a hidden constraint, a workaround, a subtle invariant. Never comment what the code already says.
- **Follow existing patterns.** Match the file structure, naming, error-handling style, and library choices already in use. Don't introduce a parallel pattern when an existing one fits.
- **Best-effort quality.** Treat each change as production-grade: tight names, no dead code, no half-finished implementations, no debug prints, no commented-out blocks.
- **No speculative abstraction.** Don't add helpers, configs, or layers for hypothetical future requirements. Three similar lines is better than a premature abstraction.
- **No backwards-compat scaffolding.** No re-exports, deprecated wrappers, or `_unused` placeholders unless explicitly required. Delete fully when removing.
- **Validate at boundaries only.** Trust internal code and framework guarantees. Validate user input and external API responses; don't write defensive checks for things that can't happen inside trusted code.

## Testing
- **Backend unit tests:** `pytest` + `pytest-bdd`, in `backend/utilities/<name>/tests/`. Map BDD scenarios in plans 1:1 to feature files.
- **Frontend unit tests:** `Vitest` (Jest-compatible API), co-located in `__tests__/` next to the component or under `frontend/src/routes/<name>/__tests__/`.
- **End-to-end tests:** `Playwright` lives at the **top-level `/playwright/` folder** with its own config, never inside `frontend/`. Add a Playwright spec only when e2e adds confidence over unit tests — typically for upload/download flows, multi-step interactions, or anything involving SSE / streaming. Skip e2e for trivial CRUD that's already covered by unit tests.

## BDD-first
- Each utility's `plans/NN-*.md` contains Gherkin scenarios. Treat those as the acceptance criteria.
- New behavior → add or update a scenario in the plan first; then implement.
- Backend: scenarios become pytest-bdd `.feature` files. Frontend e2e: scenarios become Playwright specs (where warranted).

## Stack discipline (see `plans/00-overview.md` for details)
- **Backend:** Django + DRF + Daphne, Postgres 16, Redis 7, **Poetry** for deps (in-project `.venv`, Python 3.13). Runs on the host.
- **Frontend:** React + Vite + TS + Tailwind + **TanStack Router + TanStack Query**, `pnpm`. Runs on the host.
- **Docker:** infra only (Postgres / Redis / Adminer). Backend and frontend never live in Docker.
- **No paid APIs, no LLMs** in any utility unless its plan explicitly opts in. NMT (Argos / OPUS-MT / NLLB) for translation, classical libs everywhere else.
- **Single-user, local-only.** No auth, no telemetry, no rate limiting, no analytics.

## Frontend specifics
- All server state goes through **TanStack Query** (`useQuery` / `useMutation`). No bare `fetch` in components.
- Routes are owned by **TanStack Router**. Tab/sub-state belongs in `search` params so deep links work.
- Use the installed `frontend-design` skill when building or restyling UI — distinctive aesthetic, no generic AI look (no `Inter` everywhere, no purple-gradient-on-white).
- Tailwind for styling; co-locate component styles. No CSS-in-JS libs.
- Lazy-load heavy per-route deps (e.g. `markdown-it`, `qrcode`) to keep the initial bundle small.

## Backend specifics
- One Django app per utility under `backend/utilities/<name>/`.
- Shared logic (NMT engine, common helpers) under `backend/shared/`.
- DRF errors return `{ "error": "<short>", "detail": "<safe>" }` with a meaningful HTTP status. Never leak stack traces.
- Uploaded files live in `backend/tmp/<request_id>/` and are deleted in a `finally` after the response is sent.
- Long-running work (yt-dlp downloads) is a subprocess with a cancellation hook, not an in-process blocking call.

## Git
- **Single root repo** at `/Users/josh/Documents/projects/noname/`. No sub-repos in `backend/` or `frontend/`.
- Global git identity is `josemsalcedoq <josemsalcedoq@icloud.com>`; SSH alias for any future push is `josemsalcedoq` (`git@josemsalcedoq:<owner>/<repo>.git`).
- Make **small, focused commits per logical change**. One concern per commit; commits should each compile and pass their own tests.
- Never push without explicit user instruction.
- Never add `Co-Authored-By` or any other attribution line to commits unless the user explicitly asks.

## Communication
- Spanish or English in user-facing chat — match the user's language in the current turn.
- Be concise. Lead with the result; skip narrating the process.
