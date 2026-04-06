# Load .env file if it exists
ifneq (,$(wildcard ./.env))
	include .env
	export
endif

.PHONY: help
## help: Display this help message
help:
	@echo "Usage:"
	@echo "  make <target> [variables]"
	@echo ""
	@echo "Available targets:"
	@echo ${MAKEFILE_LIST}
	@sed -n 's/^##//p' $(MAKEFILE_LIST) | column -t -s ':' |  sed -e 's/^/ /'

# ----------------------------------------------------------------------
# Environment Setup
# ----------------------------------------------------------------------

.PHONY: check-env

## check-env: Ensure .env exists; if not, copy from .env.example
check-env:
	@test -f .env || cp .env.example .env

# ----------------------------------------------------------------------
# Docker Management
# ----------------------------------------------------------------------

.PHONY: up down fresh init dev enter enter-db log log-db swagger

## up: Start Docker containers
up:
	docker compose up -d

## down: Stop Docker containers
down:
	docker compose down

## fresh: Rebuild and restart Docker containers (no cache)
init: 
	$(MAKE) check-env
	docker compose down --remove-orphans
	docker compose build --no-cache
	docker compose up -d --build -V
	$(MAKE) log

## dev: Prepare the environment and start development mode
# Development mode: tidy modules, restart containers, and follow logs
dev: down up log

## enter: Open a shell inside the app container
enter:
	docker compose exec -it app sh

## enter-db: Open a shell inside the database container
enter-db:
	docker compose exec -it database sh

## log: Follow logs for the API container
log:
	docker logs -f app

## log-db: Follow logs for the database container
log-db:
	docker logs -f database

# ----------------------------------------------------------------------
# Database Management (Kysely)
# ----------------------------------------------------------------------

.PHONY: db-migrate db-migrate-up db-migrate-down db-status db-gen-types

## db-migrate: Run all pending Kysely database migrations
db-migrate:
	@echo "Running all pending migrations..."
	@npx tsx server/db/migrate.ts latest
	@$(MAKE) db-gen-types

## db-migrate-up: Run next pending migration
db-migrate-up:
	@echo "Running next migration..."
	@npx tsx server/db/migrate.ts up
	@$(MAKE) db-gen-types

## db-migrate-down: Rollback last migration
db-migrate-down:
	@echo "Rolling back last migration..."
	@npx tsx server/db/migrate.ts down

## db-status: Show database migration status
db-status:
	@echo "Checking migration status..."
	@npx tsx server/db/migrate.ts status

## db-gen-types: Generate TypeScript types from database schema
db-gen-types:
	@echo "Generating database types..."
	@yarn db:generate-types
	@echo "Types generated successfully"

