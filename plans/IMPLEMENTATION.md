# Implementation Roadmap

End-to-end plan to take the current scaffolding (`plans/`, `docker/`, `CLAUDE.md`, `.gitignore`) all the way to four working utilities. Phases are sized so each one ends in something runnable; commits happen at logical sub-points within each phase.

## Order rationale (TL;DR)
1. **Infra → backend → frontend** so each layer has a target to connect to.
2. **Shared NMT engine** before any utility that uses it.
3. **Utility 02 (text translator) first** — simplest, validates the whole frontend↔backend↔NMT path without file-handling complications.
4. **Utility 01 (docx translator) second** — reuses NMT, adds python-docx.
5. **Utility 04 (dev tools) anytime** — frontend-only, independent.
6. **Utility 03 (yt downloader) last** — most complex (subprocess, SSE, Redis pub-sub, ffmpeg, ASGI).

## Phase 0 — Bootstrap (current state, awaiting first commit)
Already on disk:
- Root repo, `.gitignore`, `CLAUDE.md`, `plans/00–04`, this file.
- `docker/` with compose, postgres init, redis.conf, `.env`, `.env.example`.
- Global git identity = `josemsalcedoq <josemsalcedoq@icloud.com>`.

**Commits in this phase:**
- `chore: init repo with gitignore`
- `docs: add project rules (CLAUDE.md)`
- `docs(plans): add overview`
- `docs(plans): add docx translator spec`
- `docs(plans): add text translator spec`
- `docs(plans): add youtube downloader spec`
- `docs(plans): add dev tools spec`
- `docs(plans): add implementation roadmap`
- `chore(docker): add infra compose with postgres, redis, adminer`

**Done when:** `git status` clean, `git log` shows all bootstrap commits.

## Phase 1 — Infra up
1. `cd docker && docker compose up -d`
2. Verify:
   - `pg_isready -h localhost -p 5432 -U noname` → accepting
   - `redis-cli -h localhost -p 6379 ping` → PONG
   - `http://localhost:8080` (Adminer) → login screen

**Done when:** all three services healthy, can connect to Postgres from host.

## Phase 2 — Backend scaffold (Django)
1. `cd backend && uv init --package`
2. `uv add django djangorestframework django-cors-headers daphne 'psycopg[binary]' redis django-redis dj-database-url python-dotenv`
3. `uv add --dev pytest pytest-django pytest-bdd ruff`
4. `uv run django-admin startproject config .`
5. Create `backend/shared/__init__.py`, `backend/utilities/__init__.py`.
6. Configure `config/settings.py`:
   - `DATABASES` ← `dj_database_url.parse(env("DATABASE_URL"))`
   - `CACHES` ← Redis via `django-redis`
   - `INSTALLED_APPS += rest_framework, corsheaders`
   - `CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]`
   - `ASGI_APPLICATION = "config.asgi.application"`
   - Read `DEBUG`, `SECRET_KEY` from env
7. Create `backend/.env`: `DATABASE_URL=postgresql://noname:noname@localhost:5432/noname`, `REDIS_URL=redis://localhost:6379/0`, `DEBUG=true`, `SECRET_KEY=...`
8. `uv run python manage.py migrate`
9. Sanity: `uv run python manage.py runserver` → Django welcome at `:8000`.

**Commits:**
- `chore(backend): scaffold Django project`
- `feat(backend): wire postgres, redis, drf, cors`

**Done when:** server boots, hits Postgres, no warnings.

## Phase 3 — Frontend scaffold (Vite + TS + Tailwind + TanStack)
1. `cd frontend && pnpm create vite . --template react-ts` (force into existing dir, accept overwrites for empty dir)
2. `pnpm add @tanstack/react-router @tanstack/react-query`
3. `pnpm add -D tailwindcss postcss autoprefixer @tanstack/router-plugin @tanstack/router-devtools @tanstack/react-query-devtools vitest @testing-library/react @testing-library/jest-dom jsdom`
   - Note: Vitest is the unit-test runner (Jest-compatible API). **Playwright is NOT installed here** — it lives in the top-level `/playwright/` folder, see Phase 3.5.
4. `pnpm dlx tailwindcss init -p`
5. Configure:
   - `tailwind.config.js` content paths
   - `vite.config.ts`: TanStack Router plugin + `/api` proxy → `http://localhost:8000`
   - `src/index.css`: tailwind layers
   - `src/main.tsx`: `QueryClientProvider` + `RouterProvider`
   - `src/routes/__root.tsx`: app shell with sidebar (placeholder, no entries yet)
6. `pnpm dev` → `:5173` renders shell.

**At this point, invoke the `frontend-design` skill** to commit to a single aesthetic direction for the whole hub (typography, palette, motion language, layout vocabulary). All four utility pages will inherit it.

**Commits:**
- `chore(frontend): scaffold vite + ts`
- `feat(frontend): wire tailwind, tanstack router, tanstack query`
- `feat(frontend): app shell with sidebar`

**Done when:** dev server up, sidebar visible, design language locked in.

## Phase 3.5 — E2E test harness (`/playwright/`)
Top-level folder, separate from `frontend/` so e2e can drive the whole product (frontend + backend + infra) without coupling to frontend's `node_modules`.

1. `mkdir -p playwright/tests && cd playwright`
2. `pnpm init` (minimal `package.json`, name `@noname/e2e`, private)
3. `pnpm add -D @playwright/test`
4. `pnpm exec playwright install chromium`
5. `playwright.config.ts`:
   - `testDir: 'tests'`
   - `webServer`: array starting frontend on `:5173` and pointing baseURL there
   - `use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' }`
6. Add specs only when a utility warrants e2e (see `CLAUDE.md` rule).

**Commits:**
- `chore(playwright): scaffold top-level e2e harness`

**Done when:** `cd playwright && pnpm exec playwright test --list` runs without errors (zero specs is fine at this point).

## Phase 4 — Shared NMT engine
1. `cd backend && uv add argostranslate lingua-language-detector`
2. Create `backend/shared/nmt/`:
   - `engine.py` — `translate(text, source, target) -> str`, `detect(text) -> str`. Lazy-loads Argos models from `backend/models/`.
   - `manager.py` — discover available language pairs.
3. Management command `backend/shared/management/commands/download_nmt_models.py` — pulls Argos `en→es` and `es→en` to `backend/models/`.
4. `uv run python manage.py download_nmt_models`.
5. Sanity check in Django shell: `translate("hello world", "en", "es")` returns Spanish.

**Commits:**
- `feat(backend): add shared nmt engine (argos)`
- `feat(backend): add download_nmt_models management command`

**Done when:** model files present, translate function returns Spanish < 1s on CPU.

## Phase 5 — Utility 02: text translator (first end-to-end slice)

### Backend
1. `uv run python manage.py startapp text_translator utilities/text_translator`
2. `serializers.py`: `TextTranslateRequest { source, target, text }`, `TextTranslateResponse { text, detected_source? }`.
3. `views.py`: `TranslateView(APIView).post` → calls shared NMT.
4. `urls.py`: `POST /api/text-translator/translate`.
5. Register in `config/urls.py`, add app to `INSTALLED_APPS`.
6. Tests: `tests/features/translate.feature` (lifted from `plans/02`), `tests/test_translate.py` step defs.

### Frontend
1. `src/routes/text-translator/index.tsx` (TanStack Router file route).
2. `src/routes/text-translator/api.ts` — `useTranslateText` mutation.
3. UI: two-pane textareas + language selectors + swap button + copy-to-clipboard. Apply the locked-in design language.
4. Sidebar entry.
5. `playwright/tests/text-translator.spec.ts` covering the high-value BDD scenarios (skip the trivial ones already proven by Vitest unit tests).

**Commits (granular):**
- `feat(text-translator): backend app + endpoint`
- `test(text-translator): pytest-bdd scenarios`
- `feat(text-translator): frontend route + mutation`
- `feat(text-translator): two-pane UI + swap + copy`
- `test(text-translator): playwright e2e`

**Done when:** every BDD scenario in `plans/02` is green.

## Phase 6 — Utility 01: docx translator

### Backend
1. `uv add python-docx`
2. `uv run python manage.py startapp docx_translator utilities/docx_translator`
3. `services/docx_translate.py` — open with `python-docx`, walk paragraphs/runs/tables/headers/footers; translate paragraph-as-whole, then redistribute output across original runs heuristically (preserve bold/italic). Return new `.docx` as bytes.
4. `views.py`: `TranslateView` accepts multipart, returns `FileResponse`.
5. `urls.py`: `POST /api/docx-translator/translate`.
6. BDD tests for the 8 scenarios in `plans/01`.

### Frontend
1. `src/routes/docx-translator/index.tsx`.
2. `useTranslateDocx` mutation with `FormData`; response is a Blob the user downloads.
3. UI: dropzone + language selectors + indeterminate progress + download button + warnings panel.
4. Sidebar entry.
5. `playwright/tests/docx-translator.spec.ts` — upload/download flow is genuinely valuable to drive end-to-end.

**Commits:**
- `feat(docx-translator): backend service + endpoint`
- `test(docx-translator): pytest-bdd scenarios`
- `feat(docx-translator): frontend route + dropzone UI`
- `test(docx-translator): playwright e2e`

**Done when:** sample `.docx` round-trips with formatting visibly intact.

## Phase 7 — Utility 04: dev tools (frontend-only)
1. `pnpm add js-yaml smol-toml papaparse jsondiffpatch js-md5 qrcode markdown-it markdown-it-highlightjs`
2. `pnpm add -D @types/js-yaml @types/papaparse @types/markdown-it`
3. `src/routes/dev-tools/route.tsx` parent: tabs whose active tab is in `search` params.
4. Six lazy children — one per tab (format, encode/decode, hash, qr, regex, markdown).
5. **Vitest** unit tests: parser correctness, hash digests, regex highlighting, JWT decode. **No Playwright here** — every tab is pure-function logic, unit tests cover it without browser overhead.

**Commits:**
- `feat(dev-tools): route shell with tabs`
- `feat(dev-tools): format converter tab`
- `feat(dev-tools): encoder/decoder tab`
- `feat(dev-tools): hash tab`
- `feat(dev-tools): qr generator tab`
- `feat(dev-tools): regex tester tab`
- `feat(dev-tools): markdown preview tab`
- `test(dev-tools): vitest coverage`

**Done when:** each tab works offline (verify zero network requests in DevTools).

## Phase 8 — Utility 03: yt downloader

### Pre-reqs
- `brew install ffmpeg` on the host.
- `uv add yt-dlp`.

### Backend
1. `uv run python manage.py startapp youtube_downloader utilities/youtube_downloader`
2. Model `YoutubeJob` (uncomment the template in `docker/postgres/init/01-init.sql`, or just add via Django migrations — prefer migrations for reproducibility). Run `makemigrations` + `migrate`.
3. `services/ytdlp.py`:
   - `probe(url)` → metadata via `yt-dlp -J`.
   - `download(job)` → `asyncio.create_subprocess_exec` with `--newline --progress-template`, parse stdout, publish to Redis channel `progress:<jobId>`.
   - `cancel(job)` → kills the process; cleans partial file.
4. Views (DRF):
   - `ProbeView` (sync POST) → `{ url } → metadata`.
   - `DownloadView` (sync POST) → creates job, spawns subprocess, returns `{ jobId }`.
   - `ProgressView` (async GET) → SSE via `StreamingHttpResponse`, subscribes to Redis channel.
   - `CancelView` (POST).
5. **Switch dev server to Daphne** for this utility's SSE: `daphne -b 0.0.0.0 -p 8000 config.asgi:application`. `runserver` may stay for everything else but document the switch.
6. BDD tests for the 7 scenarios in `plans/03`.

### Frontend
1. `src/routes/youtube-downloader/index.tsx`.
2. Hooks: `useProbe`, `useDownload`, `useCancel` mutations; `useProgressSSE(jobId)` writing into Query cache via `queryClient.setQueryData(['progress', jobId], ...)`.
3. UI: URL input → probe panel (thumbnail, title, duration) → mode/quality select → start → progress bar with ETA/speed → cancel → download link on success.
4. Sidebar entry.
5. `playwright/tests/youtube-downloader.spec.ts` — SSE progress is the highest-value e2e in the project, covers the cancel flow too. Mock yt-dlp via a stubbed endpoint or use a short test video.

**Commits:**
- `feat(yt-downloader): job model + migrations`
- `feat(yt-downloader): ytdlp service wrapper`
- `feat(yt-downloader): probe + download + cancel endpoints`
- `feat(yt-downloader): SSE progress endpoint`
- `test(yt-downloader): pytest-bdd scenarios`
- `feat(yt-downloader): frontend route + SSE hook`
- `feat(yt-downloader): probe + progress UI`
- `test(yt-downloader): playwright e2e`

**Done when:** real YouTube URL downloads end-to-end with live progress, cancel works mid-flight.

## Phase 9 — Polish / DX
1. `Makefile` at root:
   - `make infra-up` / `infra-down`
   - `make backend` / `frontend` (start dev servers)
   - `make test` — runs backend `pytest` + frontend `vitest` + `playwright`
   - `make e2e` — playwright only (slower)
   - `make lint` — `ruff` + `eslint`
2. **Root `README.md` (required, single page).** Sections: prerequisites, one-command bring-up, common workflows, troubleshooting. English only.
3. Optional pre-commit: `ruff format`, `ruff check`, `eslint`.
4. Sanity sweep: every utility page uses the locked design language consistently (frontend-design skill review).

**Commits:**
- `chore: add Makefile`
- `docs: add README`
- `chore: pre-commit hooks (optional)`

**Done when:** `make infra-up && make backend &  make frontend &` brings everything up; `make test` is green.

## Phase 10 — Final pass
- `git log --oneline` review; squash any WIP if present.
- Verify `.gitignore` blocks `backend/models/`, `backend/tmp/`, `backend/downloads/`, `node_modules/`, `.env`.
- Confirm no leaked secrets, no large binaries.
- Spot-check that no Spanish leaked into code, identifiers, comments, or commit messages — repo language is English-only (per `CLAUDE.md`).

## Risks (revisit as we hit them)
- **Argos quality on technical / marketing copy** → may swap to NLLB-200 mid-flight in Phase 4.
- **DOCX run redistribution** after paragraph-level translation → may need a smarter heuristic; spike in Phase 6.
- **ffmpeg as host dep** (not in Docker) → user must `brew install ffmpeg` before Phase 8.
- **Daphne vs runserver** during dev → use Daphne only when SSE is needed; document the switch.
- **First-run NMT model download** is large (hundreds of MB) → flag it in README, gitignore the cache.

## Testing summary (per CLAUDE.md)
- **Unit tests are required for every utility.** Backend: `pytest` + `pytest-bdd`. Frontend: `Vitest`.
- **Playwright is reserved for utilities where e2e adds confidence over units** — currently text-translator, docx-translator, youtube-downloader. Dev-tools is unit-only.
- All test names, fixtures, and feature files are written in English.

## Definition of done (whole project)
- Every utility's BDD scenarios have green tests (pytest-bdd + Vitest); the three e2e-worthy utilities also pass Playwright.
- All four utility pages are reachable via the sidebar and look like they belong to the same product (design language coherent).
- `docker compose up -d`, `make backend`, `make frontend` is the entire onboarding for a fresh checkout. `README.md` documents this.
- `git status` clean, `git log` tells a readable story, every commit is in English.
