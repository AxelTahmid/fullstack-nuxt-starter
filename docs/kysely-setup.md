# Kysely Setup

This starter keeps the database layer intentionally small but structured the same way as `midwives`.

## Files to know

- `server/db/base.ts`: singleton Kysely connection
- `server/db/migrate.ts`: custom migration runner
- `server/db/migrations/*`: schema history
- `server/db/repository/*`: query helpers you can grow by domain
- `server/db/types.ts`: hand-authored database types for the starter schema
- `server/db/types.generated.d.ts`: optional generated reference types from the live database schema

## Local flow

```bash
cp .env.example .env
make up
make db-migrate
```

## How to extend it

1. Add a new migration in `server/db/migrations`
2. Update `server/db/types.ts`
3. Add or extend a repository under `server/db/repository`
4. Consume that repository from Nitro routes

## Generated type workflow

The starter keeps `server/db/types.ts` as the active schema contract to stay lightweight, but it now also supports the `midwives`-style type generation flow.

Commands:

```bash
make db-gen-types
make db-migrate
make db-migrate-up
```

Requirements:

- `DATABASE_URL` must be set in `.env`
- dependencies must be installed so `kysely-codegen` is available

Generated output:

- `server/db/types.generated.d.ts`

Use that file as a reference against the live database schema after migrations. If you later want to fully adopt generated DB types, switch the server-side imports intentionally instead of mixing generated and hand-authored types ad hoc.
