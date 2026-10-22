# TaskFlow

A mini project-management app: register, create projects, add tasks with status and priority, search and filter them, and track progress on a dashboard.

- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript
- **Backend:** Node.js + Express 5 + TypeScript, raw parameterised SQL via `pg`, validation with `zod`
- **Database:** PostgreSQL 16, SQL migrations in [backend/migrations](backend/migrations)
- **Auth:** bcrypt password hashing, JWT in an httpOnly cookie (Bearer header also accepted), server-side revocation on logout

## Quick start (Docker)

```bash
cp .env.example .env        # then set POSTGRES_PASSWORD and JWT_SECRET (openssl rand -hex 48)
docker compose up --build
```

| URL | What |
| --- | --- |
| http://localhost:3000 | Web app |
| http://localhost:4000/api/docs | Swagger UI (OpenAPI spec at `/api/openapi.json`) |

The backend applies migrations automatically on start. Demo data (`demo@taskflow.dev` / `demo12345`) is a dev-only script, `npm run seed` in `backend/`; it is not shipped in the production image, so with Docker just register an account in the UI.

## Local development

Prerequisites: Node 20+ (22 recommended), PostgreSQL 14+ (or Docker).

```bash
# 1. Database (skip if you already have Postgres)
docker run -d --name taskflow-pg -e POSTGRES_USER=taskflow -e POSTGRES_PASSWORD=taskflow_dev \
  -e POSTGRES_DB=taskflow -p 5433:5432 postgres:16-alpine
docker exec taskflow-pg psql -U taskflow -c "create database taskflow_test"

# 2. Backend  (http://localhost:4000)
cd backend
cp .env.example .env        # edit DATABASE_URL / JWT_SECRET
npm install
npm run migrate             # also runs automatically on `npm run dev`
npm run seed                # optional demo data
npm run dev

# 3. Frontend (http://localhost:3000) - proxies /api/* to BACKEND_URL
cd frontend
npm install
npm run dev
```

### Environment variables

| Variable | Where | Description |
| --- | --- | --- |
| `DATABASE_URL` | backend | Postgres connection string |
| `JWT_SECRET` | backend | Signing secret, **min 32 chars** (the server refuses to start otherwise) |
| `JWT_EXPIRES_IN` | backend | Token lifetime, default `7d` |
| `CORS_ORIGINS` | backend | Comma-separated browser origins allowed to call the API |
| `PORT` | backend | Default `4000` |
| `BACKEND_URL` | frontend (build time) | Where Next proxies `/api/*`; default `http://localhost:4000` |
| `POSTGRES_PASSWORD`, `JWT_SECRET` | root `.env` | Used by `docker-compose.yml` |

No secrets are committed; `.env` files are git-ignored and each has an `.env.example`.

## Tests, lint, build

```bash
cd backend  && npm run lint && npm run typecheck && npm test && npm run build
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

Backend tests are integration tests (supertest against the real Express app and a real Postgres). They use `TEST_DATABASE_URL`, defaulting to `postgres://taskflow:taskflow_dev@localhost:5433/taskflow_test`, and **truncate that database's tables**, so never point it at data you care about. CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build for both apps against a Postgres service container.

## API summary

Full spec: Swagger UI at `/api/docs`. All routes except register/login/health require authentication.

| Method & path | Purpose |
| --- | --- |
| `POST /api/auth/register`, `/login`, `/logout`; `GET /api/auth/me` | Accounts and sessions |
| `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id` | Projects, with `taskCount`, `completedCount`, `progress`; list supports `search`, `sort`, `limit` |
| `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id` | Tasks; list supports `projectId`, `status`, `priority`, `search` (title), `sort`, `order`, `page`, `limit` |
| `GET /api/dashboard` | Totals, completed/overdue counts, status breakdown, project progress |
| `GET /api/health` | Liveness + DB check |

Errors always look like `{ "error": { "code", "message", "details?" } }` with 400 (validation), 401, 404, 409, 413, 429 or 500.

## Architecture note

**Layout.** `backend/src/modules/<feature>` holds routes (HTTP + validation) and services (SQL + business rules); `middleware/` holds auth and the central error handler. The frontend keeps data fetching in a small typed client (`lib/api.ts`) and hooks, with reusable components in `components/`.

**Data model.** `users → projects → tasks`, with `ON DELETE CASCADE` so deleting a project removes its tasks. Status and priority are `CHECK`-constrained text; `due_date` is a `date`. Email uniqueness is a unique index on `lower(email)`. Indexes: `projects(user_id, updated_at DESC)` for the project list, `tasks(project_id, status)` for per-project counts and filters, and a partial index on open tasks' `due_date` for overdue queries.

**Authorization.** Tasks do not store a user id; ownership flows through their project. Every query joins or filters on `projects.user_id = <caller>` (writes included, e.g. `INSERT … SELECT … WHERE owner`, `UPDATE … FROM projects`), so ownership is enforced atomically in the same statement as the action. Another user's resource returns **404**, not 403, so IDs can't be probed. Update schemas are `.strict()`, so extra fields (e.g. `userId`, `projectId`) are rejected rather than mass-assigned.

**Authentication.** Passwords are hashed with bcrypt (cost 12; >72 bytes is rejected because bcrypt truncates). Login returns the same error for unknown email and wrong password and spends equal bcrypt time. The JWT (HS256, pinned algorithm) lives in an httpOnly, `SameSite=Lax`, `Secure`-in-production cookie. Each token carries the user's `token_version`; **logout increments it**, which invalidates all previously issued tokens, and every request re-checks it. The cost is one indexed lookup per authenticated request. The browser talks only to the Next origin, which proxies `/api/*`, so the cookie is first-party and no CORS is needed from the browser.

**Dashboard / overdue.** A task is overdue when it has a due date earlier than today (UTC) and is not Done; "due today" is not overdue. Counts are computed in SQL with `FILTER` aggregates, not in application code.

**State management.** React Context for the global auth state; page data uses local hooks (`useApiData`) with request cancellation. Server data is the source of truth, so after every mutation the list is refetched rather than kept in a client cache. A store such as Redux would add weight with no benefit here.

**Security controls.** helmet headers; explicit CORS allow-list; 100 kb body limit; rate limiting (300 req/min overall, 20 per 15 min on login/register); zod validation of every body, query and param (UUIDs, enums, real calendar dates); `LIKE` wildcards in search are escaped; all SQL is parameterised; stack traces and DB errors never reach clients; the server refuses to boot with a weak or missing `JWT_SECRET`; containers run as a non-root user.

## Decisions and trade-offs

- **Raw SQL over an ORM**: the schema is tiny and the dashboard aggregates are clearer in SQL; the cost is hand-written row mapping.
- **Express over NestJS**: both are allowed; Express keeps the codebase small.
- **Task list is capped at 200 per request** (the board shows all statuses at once). The API paginates (`page`, `limit`), but the UI shows a notice rather than paging when a filter matches more than 200 tasks.
- **Swagger UI is served by the backend** (`:4000/api/docs`), not through the Next proxy, because Next's trailing-slash handling conflicts with Swagger UI's redirect.
- **Dates**: `due_date` is a plain calendar date; "today" is evaluated in UTC, so a user far from UTC may see a task flip to overdue a few hours early or late.
- **Tokens last 7 days** with no refresh rotation; logout revokes them server-side.

## Known limitations / not done

- No drag-and-drop Kanban (status is changed with a dropdown), no refresh-token rotation, no deployment to a public host, no end-to-end browser tests.
- No password reset or email verification.
- `npm audit` reports advisories in the **dev/build toolchain** of the frontend (the `braces` chain under `eslint-config-next`, and `postcss` bundled inside Next 15). These only process the project's own source at build time; the suggested fixes are breaking upgrades (Next 16), which were not taken.
- The UI was exercised through the production build and the proxy via HTTP and component tests, but **not clicked through in a real browser** during development.
