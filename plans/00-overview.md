# 00 — Overview: Personal Utilities Hub

## Goal
A single web app for personal use that bundles small, self-contained utilities behind a left-side menu. Each utility is independent, runs locally, and uses **free / open-source / no-API-key** dependencies wherever possible.

## Non-goals (explicit out-of-scope)
- Multi-user, accounts, login, auth.
- Public deployment, SaaS, billing.
- Cloud APIs that require payment (OpenAI, DeepL Pro, etc.).
- LLM-powered features. NMT and classical libraries only unless a utility's plan explicitly opts in.
- Rate limiting, abuse protection, audit logs — single-user app.

## Users
Single user (the developer). Runs locally on `localhost`. No data leaves the machine unless a utility explicitly fetches a public resource (e.g. yt-dlp downloading a video).

## Stack

### Backend
- **Python 3.13** (pinned in `pyproject.toml`), **Django**, **Django REST Framework** for JSON APIs.
- **Daphne** as the ASGI server (needed for SSE / async views in the YouTube progress stream). `runserver` is fine for day-to-day dev.
- **PostgreSQL 16** (via Docker) for any persistent state utilities introduce (job history, settings).
- **Redis 7** (via Docker) for SSE pub-sub and as a generic cache.
- **Poetry** for dependency management — in-project `.venv` (configured via `poetry config virtualenvs.in-project true --local`), `pyproject.toml` + `poetry.lock`.
- **Testing:** `pytest` + `pytest-django` + `pytest-bdd` (Gherkin scenarios from each plan map directly to feature files).

### Frontend
- **React 18 + TypeScript + Vite**.
- **TanStack Router** for file-based / type-safe routing across utility pages.
- **TanStack Query** (React Query) for all server state — caching, mutations, SSE/streamed responses where they apply.
- **Tailwind CSS** for styling.
- **Package mgmt:** `pnpm` (preferred) or `npm`.
- **Testing:** `vitest` for units, **Playwright** for end-to-end against the BDD scenarios.

### Process model
- **Backend and frontend run on the host**, not in Docker.
  - Backend: `python manage.py runserver` → `localhost:8000`.
  - Frontend: `pnpm dev` (Vite) → `localhost:5173`. Vite proxies `/api/*` → `localhost:8000`.
- **Docker only for stateful infra**: Postgres, Redis, Adminer (see `docker/docker-compose.yml`). Started with `docker compose up -d` from `docker/`.
- Backend connects to infra via `localhost`: `DATABASE_URL=postgresql://noname:noname@localhost:5432/noname`, `REDIS_URL=redis://localhost:6379/0`. These live in `backend/.env` (separate from `docker/.env`).

## Architecture (high level)

```
[ React SPA ] ──/api/<utility>/...──> [ Django + DRF ] ──> [ utility app ]
   TanStack Router + Query              per-utility            (local libs:
   sidebar menu                         Django apps            argos, yt-dlp,
                                                               python-docx, …)
```

- Each utility is its own **Django app** under `backend/utilities/<name>/`.
- Each utility has its own **TanStack route** under `frontend/src/routes/<name>/`.
- A shared sidebar lists all enabled utilities.
- Utilities are self-contained: a utility's backend code, frontend page, and tests live together (or at least are easy to find together).

## Folder layout (target)

```
noname/
├── backend/                       # runs on host, not in Docker
│   ├── manage.py
│   ├── pyproject.toml
│   ├── .env                       # DATABASE_URL, REDIS_URL, etc.
│   ├── config/                    # Django project (settings, urls, asgi)
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── asgi.py
│   ├── shared/
│   │   └── nmt/                   # Argos / OPUS-MT wrapper, used by 01 and 02
│   └── utilities/
│       ├── docx_translator/       # Django app
│       ├── text_translator/
│       └── youtube_downloader/
├── frontend/                      # runs on host, not in Docker
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx               # React + Router + Query providers
│       ├── routes/                # TanStack Router routes
│       │   ├── __root.tsx         # shell + sidebar
│       │   ├── docx-translator/
│       │   ├── text-translator/
│       │   └── youtube-downloader/
│       └── lib/
│           └── api.ts             # axios/fetch + Query hooks
├── docker/
│   ├── docker-compose.yml
│   ├── .env                       # gitignored, local defaults
│   ├── .env.example               # tracked template
│   ├── postgres/init/01-init.sql
│   └── redis/redis.conf
├── playwright/                    # top-level e2e (only where it adds value)
│   ├── package.json
│   ├── playwright.config.ts
│   └── tests/
│       └── <utility>.spec.ts
├── plans/
│   ├── 00-overview.md             (this file)
│   ├── 01-docx-translator.md
│   ├── 02-text-translator.md
│   ├── 03-youtube-downloader.md
│   ├── 04-dev-tools.md
│   └── IMPLEMENTATION.md          # phased roadmap, single source for build order
├── CLAUDE.md                      # project-wide rules (testing, language, conventions)
└── README.md                      # one-page bring-up for a fresh checkout
```

## Plan file convention
- One `.md` per utility, numbered: `NN-utility-name.md`.
- Each plan contains: **Goal, Inputs/Outputs, Functional Requirements, Non-Functional, BDD Scenarios (Given/When/Then), Out of Scope, Tech Notes, Open Questions**.
- BDD-style scenarios act as the acceptance criteria. They become the test cases later.
- "High-level" here means: enough to scope an MVP, not enough to write code from. Implementation details are decided when the task is picked up.

## Adding a new utility
1. Add `plans/NN-name.md` using the same section structure as existing plans.
2. Backend: `cd backend && python manage.py startapp <name> utilities/<name>` (or hand-create), register in `INSTALLED_APPS`, include its `urls.py` from `config/urls.py` under `/api/<slug>/`.
3. Frontend: add a folder under `src/routes/<name>/` (TanStack Router auto-registers it) and a sidebar entry.
4. Tests:
   - **Unit (backend):** `backend/utilities/<name>/tests/` — `pytest` + `pytest-bdd` features mirroring `plans/NN`.
   - **Unit (frontend):** `frontend/src/routes/<name>/__tests__/` — `Vitest`.
   - **E2E (top-level):** `playwright/tests/<name>.spec.ts` — only if e2e adds confidence over the unit tests above (uploads, downloads, SSE, multi-step flows).

## Cross-cutting conventions
- **No secrets in repo.** `docker/.env` holds local-only defaults.
- **Local files only.** Uploaded files go to `backend/tmp/<request_id>/` and are deleted after response is served.
- **Errors:** DRF returns JSON `{ "error": "<short>", "detail": "<safe>" }`. Frontend surfaces via TanStack Query error states + a toast.
- **No telemetry, no analytics.** Personal tool.

## Open questions (resolve before MVP)
- Where should NMT model weights live? Default: `backend/models/` cached, gitignored, mounted as a Docker volume so re-builds don't re-download.
- Should each utility be toggle-able via a config flag (e.g. `ENABLED_UTILITIES` env var)?
- TanStack Router file-based vs code-based routes — leaning file-based for less boilerplate.
- Daphne vs Django's built-in `runserver` for dev — `runserver` for speed, switch to Daphne when SSE is wired up.
