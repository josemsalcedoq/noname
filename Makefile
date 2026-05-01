.PHONY: help infra-up infra-down infra-logs backend frontend e2e test test-backend test-frontend test-e2e lint nmt-models migrate

ROOT := $(CURDIR)

help:
	@echo "noname — common targets"
	@echo "  infra-up       start postgres, redis, adminer (docker)"
	@echo "  infra-down     stop docker services"
	@echo "  infra-logs     tail docker logs"
	@echo "  backend        run django dev server (host)"
	@echo "  frontend       run vite dev server (host)"
	@echo "  migrate        run django migrations"
	@echo "  nmt-models     download argos en<->es models"
	@echo "  test           run all tests (backend + frontend + e2e)"
	@echo "  test-backend   run pytest"
	@echo "  test-frontend  run vitest"
	@echo "  test-e2e       run playwright"
	@echo "  lint           run ruff + eslint"

infra-up:
	cd $(ROOT)/docker && docker compose up -d

infra-down:
	cd $(ROOT)/docker && docker compose down

infra-logs:
	cd $(ROOT)/docker && docker compose logs -f --tail=50

backend:
	cd $(ROOT)/backend && poetry run python manage.py runserver 0.0.0.0:8000

frontend:
	cd $(ROOT)/frontend && pnpm dev

migrate:
	cd $(ROOT)/backend && poetry run python manage.py migrate

nmt-models:
	cd $(ROOT)/backend && poetry run python manage.py download_nmt_models

test: test-backend test-frontend test-e2e

test-backend:
	cd $(ROOT)/backend && poetry run pytest

test-frontend:
	cd $(ROOT)/frontend && pnpm exec vitest run

test-e2e:
	cd $(ROOT)/playwright && pnpm exec playwright test

lint:
	cd $(ROOT)/backend && poetry run ruff check . && poetry run ruff format --check .
	cd $(ROOT)/frontend && pnpm exec eslint .
