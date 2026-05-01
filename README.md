# noname

A personal utilities hub. Local-only, no telemetry, no paid APIs, no LLM round-trips. Four utilities behind a sidebar:

- **Text translator** — English ↔ Spanish via local NMT (Argos / OPUS-MT).
- **DOCX translator** — Upload a `.docx`, download the translated copy with paragraph order preserved.
- **YouTube downloader** — yt-dlp wrapper with probe, video / audio-only modes, and live polling progress.
- **Dev tools** — Six tabs: format converter (JSON ↔ YAML ↔ TOML ↔ CSV), encoder/decoder + JWT, hash, QR, regex, markdown preview. 100% client-side.

The product specs live in [`plans/`](./plans/); see [`plans/00-overview.md`](./plans/00-overview.md) for architecture and [`plans/IMPLEMENTATION.md`](./plans/IMPLEMENTATION.md) for the build phases. Project-wide rules are in [`CLAUDE.md`](./CLAUDE.md).

## Prerequisites

| Tool       | Version                                | Notes |
|------------|----------------------------------------|-------|
| Docker     | recent                                 | runs Postgres / Redis / Adminer |
| Python     | 3.13                                   | `brew install python@3.13` |
| Poetry     | 2.x                                    | `brew install poetry` |
| Node.js    | 22+                                    | use `nvm` or your preferred manager |
| pnpm       | 10.x                                   | `corepack enable pnpm` |
| ffmpeg     | 6+                                     | `brew install ffmpeg` (yt-downloader only) |

## Bring-up

```bash
# 1. infra (one-shot)
make infra-up

# 2. backend deps + DB + NMT models (one-shot per fresh checkout)
cd backend && poetry install
make migrate
make nmt-models     # ~150 MB download (en<->es Argos packages)

# 3. frontend deps (one-shot)
cd ../frontend && pnpm install

# 4. run dev servers (two terminals)
make backend        # http://localhost:8000
make frontend       # http://localhost:5173
```

The frontend dev server proxies `/api/*` to the backend.

## Testing

```bash
make test-backend   # pytest + pytest-bdd  (Django / utility scenarios)
make test-frontend  # vitest               (unit tests)
make test-e2e       # playwright           (text-translator, docx-translator, yt-downloader)
```

`make test` runs all three. The e2e harness lives at top-level [`playwright/`](./playwright/) and starts both backend and frontend automatically via `webServer` config.

## Layout

```
noname/
├── backend/            Django + DRF + Daphne, Poetry-managed
│   ├── config/         settings, urls, asgi
│   ├── shared/         NMT engine + management commands
│   └── utilities/      one Django app per utility
├── frontend/           Vite + React + TS + Tailwind 4 + TanStack Router/Query
│   └── src/routes/     one folder per utility
├── playwright/         top-level e2e harness
├── docker/             infra (compose + postgres init + redis conf)
└── plans/              product specs and the implementation roadmap
```

## Conventions

- **Single-user, local-only.** No auth, no telemetry, no public deployment.
- **English everywhere** (code, identifiers, comments, commits, plans).
- **Backend & frontend run on the host**; Docker is infra only.
- **Small commits per logical change.** See `git log` for the build history.
- **Free / open-source dependencies.** No paid APIs, no LLMs.

## Adding a new utility

1. Write `plans/NN-name.md` with goal, I/O, BDD scenarios, tech notes.
2. Backend: `cd backend && poetry run python manage.py startapp <name> utilities/<name>`, register in `INSTALLED_APPS`, mount its `urls.py` from `config/urls.py`.
3. Frontend: add a route folder under `src/routes/<name>/` and a sidebar entry in `src/routes/__root.tsx`.
4. Tests: `pytest-bdd` (backend), `vitest` (frontend), `playwright/tests/<name>.spec.ts` if e2e earns its keep.
