# AGENTS.md - Nuxt 4 Full-Stack Starter Guide

This repository is a full-stack Nuxt v4 starter, Use these rules when making changes.

---

## 0) Non-negotiables

- Before modifying code, evaluate each installed skill against the current task. For each skill, determine YES/NO relevance and invoke all YES skills before proceeding.
- For frontend UI work, treat the dashboard design/system skills in `.agents/skills/*` as relevant by default when the task touches pages, shared UI, datatables, forms, overlays, or layout polish.
- No placeholders. No TODOs. No "left as an exercise".
- Keep TypeScript strict. Avoid `any` unless the reason is documented inline.
- Ship working code with correct imports, runtime behavior, and error handling.
- Match existing patterns before introducing new abstractions.

---

## 1) Tech Stack Summary

- Framework: Nuxt v4
- Rendering mode: SSR app (`ssr: true`) with Nitro server endpoints
- Language: TypeScript
- Styling: TailwindCSS v4 in `app/assets/css/main.css`
- UI primitives: shadcn-vue in `app/components/ui/*`
- Tables: `@tanstack/vue-table` via `app/components/datatable/*`
- Forms: `@tanstack/vue-form` + `zod`
- Auth/session: `nuxt-auth-utils`
- Database: PostgreSQL + Kysely in `server/db/*`
- Background jobs: pg-boss in `server/db/queue/*`
- Mail: nodemailer in `server/utils/mailer.ts`

---

## 2) Project Layout & Naming

Use Nuxt conventions.

- `app/components` - shared/reusable Vue components
- `app/pages` - routes
- `app/pages/**/_lib` - route-owned components
- `app/composables` - shared page/domain logic
- `app/layouts` - layouts
- `app/middleware` - middleware
- `server/api` - HTTP endpoints
- `server/db` - Kysely base, migrations, schema types, repositories, queue
- `server/plugins` - Nitro startup wiring
- `server/utils` - server-only helpers
- `shared` - logic and types safe to use on both server and client
- `docs` - repo documentation

Naming:

- Components: `PascalCase.vue`
- Folders: `kebab-case`
- Composables: `useThing.ts`

Imports:

- Use absolute imports (`~/`, `~~/`, `#shared`) instead of long relative traversal.
- Frontend code must not import from `server/*`.
- If a type is needed by both frontend and backend, export it from `shared/*`.

Vue SFC rules:

- Always use `<script setup lang="ts">`
- Composition API only
- Use `useTemplateRef()` for template refs

Component placement:

- Shared/reusable components go in `app/components/*`
- Route-owned components go under that route's `_lib/`

---

## 3) UI & Styling Conventions

Design priorities:

1. UX clarity
2. Operational simplicity
3. Visual polish

Rules:

- Prefer shadcn-vue primitives before inventing custom ones.
- Prefer existing shell/table/form patterns before creating new abstractions.
- Tailwind ordering should stay readable: layout -> spacing -> color -> typography.
- Use semantic theme tokens from `app/assets/css/main.css` instead of hard-coded colors when practical.
- Avoid decorative marketing-style UI on application pages.
- Use cards only when they improve grouping.

State UX expectations:

- Initial load: show `Skeleton`
- Background refetch: keep data visible, show subtle loading feedback
- Empty state: icon + message + primary action
- Page-level errors: inline `Alert`
- Transient failures: toast

---

## 4) Forms

- Use `@tanstack/vue-form` for non-trivial forms.
- Use `zod` schemas for submit validation.
- Use shadcn `Field*` components for labels, descriptions, and field-level errors.
- Disable submit while pending and show a spinner/loading indicator.
- Show toast feedback for success/failure when appropriate.

Schema rules:

- Prefer shared schemas if they are already defined in `shared/*`.
- UI-only form fields may use a composed local schema, but transform cleanly into the API payload.

---

## 5) Tables, Filters, and Query Params

Route query params are the source of truth for standard list state.

- Initialize filters/search/pagination from `route.query`
- Write updates back to query params
- Reset `page` to `"1"` when filters or search change
- Keep serialization deterministic and string-safe
- Keep multi-select encoding consistent within a page

Use and extend:

- `app/components/datatable/*`

Do not build one-off table infrastructure per page when the shared datatable layer fits.

Table typing rules:

- Column definitions must be typed
- Row models must be explicit
- Frontend table row types must come from `shared/*` when reused across API and UI layers
- Frontend must not import DB table types directly from `server/db/*`

---

## 6) API & Server Route Rules

### Core rules

- Database work happens server-side only.
- Use `defineEventHandler`.
- Validate request payloads with Zod via `readValidatedBody` when possible.
- Throw `createError` for failures instead of returning ad-hoc error objects.
- Reuse repository methods instead of repeating SQL in handlers.

### Handler shape

- Parse/validate input
- Call repository/service/queue helpers
- Return a small, typed response shape
- Do not bury business logic directly in route handlers

### Shared response types

- If a response type is reused by frontend code, export it from `shared/*`.
- API handlers may use repository-returned DB rows internally, but UI-facing response contracts should be stabilized in shared types when they become shared domain concepts.

---

## 7) Database Rules

### General

- Use Kysely through `server/db/base.ts` and repository helpers in `server/db/repository/*`.
- Do not query the database directly from frontend code.
- Keep secrets in runtime config/env only.
- Prefer repository methods for all non-trivial queries.

### Repositories

- All query logic belongs in `server/db/repository/*`
- Keep repository methods narrow, typed, and composable
- Use transactions for multi-step writes that must stay consistent
- Keep route handlers thin by pushing query logic down into repositories

### Current schema typing model in this starter

- The starter currently keeps DB schema types in `server/db/types.ts`
- Those types are the Kysely schema source of truth for the current project
- Generated reference types are written to `server/db/types.d.ts` via `make db-gen-types`
- If the schema changes, update migrations and schema types together

### Generated table types and shared exports

The repo also supports generated DB reference types. Follow this rule set:

- Generated DB types live under `server/db/*`
- The current generated output file is `server/db/types.d.ts`
- Generated files are never edited manually
- Frontend code must never import generated DB types from `server/db/*`
- Create stable shared exports in `shared/*` for anything the frontend needs

Examples of acceptable patterns:

- `shared/types/user.ts` exports `UserListRow`, `UserDetail`, `CreateUserBody`
- `shared/types/table.ts` exports reusable datatable row contracts
- `shared/schemas/*.ts` exports Zod schemas shared between frontend and backend

Practical rule:

- Server owns raw database table types
- Shared owns frontend-safe exported domain types
- Frontend imports only from `shared/*`

This separation matters because:

- DB tables often contain fields the frontend should not couple to
- shared types provide a stable boundary if schema internals change
- frontend code should depend on domain contracts, not storage layout

### Migrations

- Migration runner: `server/db/migrate.ts`
- Migration files: `server/db/migrations/*`
- Keep migrations schema-frozen and explicit
- Every schema change must be represented by a migration

When changing schema:

1. Add the migration
2. Update `server/db/types.ts`
3. Refresh generated reference types in `server/db/types.d.ts` with `make db-gen-types`
4. Update repositories
5. Update shared exported types if the UI/API contract changed
6. Update docs if the workflow changed

---

## 8) Shared Type Boundary Rules

The frontend has to import shared contracts from `shared/*`, not `server/*`.

Use `shared/*` for:

- DTOs returned by server routes
- form payload types used on both sides
- table row types used by frontend pages
- shared utility functions
- shared validation schemas

Do not use `shared/*` for:

- DB connection logic
- repository implementations
- secrets/runtime-only logic
- pg-boss startup wiring

Good pattern:

- repository returns DB rows
- server route maps them into a shared DTO shape
- frontend imports that DTO type from `shared/*`

Bad pattern:

- frontend imports `UserRecord` or raw Kysely table types from `server/db/types.ts`

---

## 9) Queue and Background Job Rules

Queue setup is initialized in:

- `server/plugins/queue.ts`

Queue code lives in:

- `server/db/queue/index.ts`
- `server/db/queue/config.ts`
- `server/db/queue/workers/*`

Rules:

- Add new jobs through typed queue helpers, not ad-hoc raw pg-boss calls in route handlers
- Workers must be idempotent where practical
- Workers must log meaningful failures
- Keep job payloads explicit and typed
- Queue names must be centralized in `server/db/queue/workers/index.ts`
- Queue retry/expiry behavior must be configured centrally in `server/db/queue/config.ts`

Expected flow for a new job:

1. Define the job name and payload type in the queue worker index
2. Add queue config in `server/db/queue/config.ts`
3. Implement the worker in `server/db/queue/workers/*`
4. Register the worker in `server/db/queue/index.ts`
5. Add a typed convenience method on the queue wrapper
6. Call that wrapper from the route/service layer

Do not:

- call `boss.send(...)` directly from scattered handlers
- duplicate queue names as raw strings across files
- pass loose `object` payloads when a typed payload exists

Queue usage guidance:

- Use queue jobs for mail, notifications, slow side effects, and non-blocking work
- Do not queue work that must complete inline to keep data correct unless the product explicitly tolerates eventual consistency

---

## 10) Mail Rules

- Centralize mail delivery in `server/utils/mailer.ts`
- Prefer queueing mail from routes instead of sending inline
- Keep mail templates/data explicit
- Support both local development and production mail flows cleanly

---

## 11) TypeScript Standards

- Prefer explicit types for props, emits, composable returns, API responses, and table rows
- Prefer `type` aliases unless `interface` extension/merging is actually needed
- Prefer `unknown` plus narrowing over `any`
- Avoid leaking storage-layer types into UI code

---

## 12) Quality Bar

- Keep diffs focused and minimal
- Preserve backward compatibility for existing query param formats unless explicitly changing them
- If no test harness exists for a change, keep logic modular and testable
- Extract pure helpers into `shared/*` or local utilities where it improves clarity
- Run relevant checks when possible: lint, typecheck, migration status

---

## 13) If Unsure

If a convention is unclear:

1. Search the current repo first
2. Match the established pattern in the same domain
3. Prefer existing repo structure over new abstractions

For frontend decisions, match the dashboard shell/datatable/form style already present here.

For backend decisions, match the repository/migration/queue discipline from the existing server code.
