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

## init: Rebuild and restart Docker containers (no cache)
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

.PHONY: db-migrate db-up db-down db-status db-gen db-seed db-reset

## db-latest: Run all pending Kysely database migrations and seed demo data
db-latest:
	@echo "Running all pending migrations..."
	@docker compose exec app npx tsx server/db/migrate.ts latest
	@$(MAKE) db-gen
	@$(MAKE) db-seed

## db-seed: Seed demo customer data
db-seed:
	@echo "Seeding demo data..."
	@docker compose exec app npx tsx server/db/seed.ts

## db-up: Run next pending migration
db-up:
	@echo "Running next migration..."
	@docker compose exec app npx tsx server/db/migrate.ts up
	@$(MAKE) db-gen

## db-down: Rollback last migration
db-down:
	@echo "Rolling back last migration..."
	@docker compose exec app npx tsx server/db/migrate.ts down

## db-status: Show database migration status
db-status:
	@echo "Checking migration status..."
	@docker compose exec app npx tsx server/db/migrate.ts status

## db-reset: Reset database to initial state (rollback all migrations)
db-reset:
	@echo "Resetting Database..."
	@docker compose exec app npx tsx server/db/migrate.ts reset
	@echo "Seed demo data..."
	@$(MAKE) db-seed

## db-gen: Generate TypeScript types from database schema
db-gen:
	@echo "Generating database types..."
	@docker compose exec app yarn db:generate-types
	@echo "Types generated successfully"
