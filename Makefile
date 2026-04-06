# Load local .env if it exists (local overrides system).
ifneq (,$(wildcard ./.env))
	include .env
	export
endif

COMPOSE ?= docker compose
POSTGRES_SERVICE ?= postgres
MAIL_SERVICE ?= mailpit
NPX ?= npx

.PHONY: help check-env up down fresh dev log-db log-mail db-shell db-query db-migrate db-migrate-up db-migrate-down db-gen-types db-status db-up db-down lint typecheck

## help: Display available targets
help:
	@echo "Usage:"
	@echo "  make <target> [variables]"
	@echo ""
	@echo "Available targets:"
	@sed -n 's/^##//p' $(MAKEFILE_LIST) | column -t -s ':' | sed -e 's/^/ /'

## check-env: Ensure .env exists; if not, copy from .env.example
check-env:
	@test -f .env || cp .env.example .env

## up: Start local support services
up: check-env
	@$(COMPOSE) up -d $(POSTGRES_SERVICE) $(MAIL_SERVICE)

## down: Stop local support services
down:
	@$(COMPOSE) down

## fresh: Recreate local support services and volumes
fresh: check-env
	@$(COMPOSE) down -v --remove-orphans
	@$(COMPOSE) up -d $(POSTGRES_SERVICE) $(MAIL_SERVICE)

## dev: Prepare local services for development
dev: up

## log-db: Follow PostgreSQL logs
log-db:
	@docker logs -f starter-postgres

## log-mail: Follow Mailpit logs
log-mail:
	@docker logs -f starter-mailpit

## db-shell: Open a psql shell inside the PostgreSQL container
db-shell:
	@$(COMPOSE) exec $(POSTGRES_SERVICE) psql -U "$(DB_USER)" -d "$(DB_NAME)"

## db-query: Run a SQL query with make db-query q='select now();'
db-query:
	@if [ -z "$(q)" ]; then \
		echo "Error: q is required. Example: make db-query q='select now();'"; \
		exit 1; \
	fi
	@$(COMPOSE) exec -T $(POSTGRES_SERVICE) psql -U "$(DB_USER)" -d "$(DB_NAME)" -c "$(q)"

## db-migrate: Run all pending migrations and refresh generated DB types
db-migrate:
	@$(NPX) tsx server/db/migrate.ts latest
	@$(MAKE) db-gen-types

## db-migrate-up: Run the next migration step and refresh generated DB types
db-migrate-up:
	@$(NPX) tsx server/db/migrate.ts up
	@$(MAKE) db-gen-types

## db-migrate-down: Roll back the last migration step
db-migrate-down:
	@$(NPX) tsx server/db/migrate.ts down

## db-gen-types: Generate Kysely types from the live database schema
db-gen-types:
	@$(NPX) kysely-codegen

## db-status: Show migration status
db-status:
	@$(NPX) tsx server/db/migrate.ts status

## db-up: Alias for db-migrate-up
db-up: db-migrate-up

## db-down: Alias for db-migrate-down
db-down: db-migrate-down

## lint: Run eslint
lint:
	@$(NPX) eslint . --quiet

## typecheck: Run Vue and TypeScript checks
typecheck:
	@$(NPX) vue-tsc --noEmit
