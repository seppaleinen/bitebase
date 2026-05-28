# BiteBase — Agent Guide

Everything an agent needs to understand the project, make changes safely, and avoid re-litigating decisions we've already settled.

---

## What this project is

BiteBase is an interactive micro-learning app. The user tells it what they want to learn, the AI asks follow-up questions (experience level, goals, daily time), then generates a personalized curriculum with markdown lessons and quizzes. Lessons are unlocked in order; each one requires passing the previous quiz (≥ 70%).

The app runs on the web (Next.js) and mobile (Expo). Both share backend logic via a monorepo.

---

## Monorepo layout

```
bitebase/
├── apps/
│   ├── web/          Next.js 15 (App Router)
│   └── mobile/       Expo SDK 56 (React Native + Expo Router)
├── packages/
│   ├── ai/           Vercel AI SDK config, Zod schemas, prompts, tools
│   ├── api/          tRPC v11 router + Better Auth config
│   ├── db/           Drizzle ORM client + PostgreSQL schema + migrations
│   └── ui/           Shared React components (web only for now)
├── turbo.json
└── pnpm-workspace.yaml
```

Package names follow `@bitebase/<name>` (e.g. `@bitebase/db`, `@bitebase/api`).

---

## Stack decisions — do not revisit without good reason

| Concern | Choice | Why |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | Standard for this shape of project; task caching is already configured |
| Web framework | Next.js 15, App Router | Server components, Server Actions, streaming all used |
| Mobile | Expo SDK 56, Expo Router | File-based routing, OTA updates, shares React with web |
| API layer | tRPC v11 with `httpBatchStreamLink` | End-to-end type safety shared across web and mobile |
| Database | PostgreSQL + Drizzle ORM | Type-safe queries; Drizzle Kit for migrations |
| Auth | Better Auth with Drizzle adapter | Session stored in DB; email/password; OAuth-ready |
| AI | Vercel AI SDK → Ollama (local, OpenAI-compatible) | Model-agnostic; swap model via `OLLAMA_MODEL` env var |
| Web search | Tavily API | Used during lesson generation to fetch source material |
| Styling (web) | Tailwind CSS + `@tailwindcss/typography` | `prose` classes used for markdown lesson rendering |
| Styling (mobile) | NativeWind | Tailwind classes compiled for React Native |
| UI components | `class-variance-authority` + `clsx` + `tailwind-merge` | Variant-safe component API |

---

## Environment variables

All env vars live in `apps/web/.env.local` (copy from `.env.example`). The database package reads `DATABASE_URL` from there via `dotenv` in `drizzle.config.ts` for CLI commands.

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bitebase
BETTER_AUTH_SECRET=<32-char hex — openssl rand -hex 32>
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2
TAVILY_API_KEY=tvly-...          # optional; web search is skipped if absent
```

---

## Common commands

Run everything from the repo root unless stated otherwise.

```bash
pnpm install                    # install all deps
pnpm dev                        # start all apps in dev mode (Turborepo)
pnpm build                      # production build
pnpm lint                       # lint all packages
pnpm type-check                 # tsc --noEmit across all packages

# Database
pnpm db:push                    # sync schema to DB (no migration file)
pnpm db:generate                # generate a migration file
pnpm db:migrate                 # run pending migrations

# Tests
pnpm test                       # run all Vitest suites (unit + integration)
pnpm --filter @bitebase/api test        # api package only
pnpm --filter @bitebase/ai test         # ai package only
pnpm --filter @bitebase/web test:e2e    # Playwright E2E (needs dev server)
pnpm --filter @bitebase/web test:e2e:ui # Playwright with UI mode
```

---

## Key source files — read these before editing related code

| File | What it does |
|---|---|
| `packages/db/src/schema/learning.ts` | All learning-domain tables: `learningProfiles`, `curricula`, `lessons`, `quizzes`, `progress`, `streaks`. If you add a column, run `pnpm db:push`. |
| `packages/db/src/schema/users.ts` | Better Auth user/session/account tables — do not edit manually; Better Auth owns this shape. |
| `packages/db/src/client.ts` | Lazy-initialized Drizzle client via a `Proxy`. Intentionally deferred so the build never needs `DATABASE_URL`. Do not change this to eager init. |
| `packages/api/src/trpc.ts` | tRPC context (`createContext`) and middleware. `protectedProcedure` guards all authenticated routes. |
| `packages/api/src/routers/curriculum.ts` | The only router right now. Contains all lesson/quiz/progress mutations and queries. |
| `packages/api/src/lib/quiz-scoring.ts` | Pure function `scoreQuiz()` extracted from the router — the only complex business logic eligible for unit tests. |
| `packages/ai/src/schemas/index.ts` | Zod schemas for AI-structured outputs: `learningProfileSchema`, `curriculumPlanSchema`, `quizQuestionSchema`, `lessonContentSchema`. |
| `packages/ai/src/prompts/index.ts` | System prompts for onboarding, curriculum generation, and lesson generation. |
| `packages/ai/src/tools/index.ts` | `finalizeProfileTool` (onboarding) and `webSearchTool` (Tavily). |
| `apps/web/src/app/(app)/layout.tsx` | Server component that checks the session on every authenticated page. Contains the Playwright E2E bypass (see Testing section). |
| `apps/web/src/app/api/onboarding/chat/route.ts` | Streaming AI chat endpoint for the onboarding flow. |
| `apps/web/src/app/api/onboarding/generate/route.ts` | SSE endpoint that generates the full curriculum (calls AI for plan + each lesson). |

---

## Database schema (condensed)

```
users                  — managed by Better Auth
learning_profiles      — topic, experienceLevel, goals, availableMinutesPerDay
curricula              — title, description, sections (JSONB), generationStatus
lessons                — content (markdown), sources (JSONB), order, estimatedMinutes
quizzes                — questions (JSONB: QuizQuestion[]), passingScore (default 70)
progress               — per-user per-lesson: status enum, quizScore, quizPassed, quizAttempts
streaks                — currentStreak, longestStreak (one row per user)
```

**Lesson status enum**: `locked → available → in_progress → completed`

Lesson 0 starts as `available`; subsequent lessons are unlocked by `unlockNextLesson()` in the curriculum router when the previous quiz is passed.

**`QuizQuestion` shape** (stored as JSONB in `quizzes.questions`):
```typescript
{
  id: string;
  type: "multiple_choice" | "fill_in_blank";
  question: string;
  options?: string[];     // 4 items for multiple_choice
  correctAnswer: string;
  explanation: string;
}
```

---

## tRPC API

The router is at `packages/api/src/router.ts`, which composes `curriculumRouter`. All procedures are protected (require a session).

**Procedures**:
- `curriculum.list` → all curricula for the current user
- `curriculum.get({ id })` → single curriculum (ownership checked)
- `curriculum.getLessons({ curriculumId })` → lessons + progress map
- `curriculum.getLesson({ lessonId })` → lesson + quiz + progress
- `curriculum.submitQuiz({ lessonId, answers })` → grades quiz, updates progress, unlocks next lesson if passed
- `curriculum.markLessonStarted({ lessonId })` → creates/updates progress row
- `curriculum.getProfile({ curriculumId })` → linked learning profile

The tRPC client in the web app uses `httpBatchStreamLink` (POST to `/api/trpc`).

---

## AI / onboarding flow

1. User chats at `/onboarding` → `POST /api/onboarding/chat` (streaming via Vercel AI SDK `streamText`)
2. When enough info is gathered the AI calls the `finalizeProfile` tool → client receives the profile
3. Client POSTs to `POST /api/onboarding/generate` → SSE stream:
   - `status` events with progress messages
   - `curriculum_created` event with `curriculumId` and `totalSections`
   - One lesson generated per subsection (AI writes markdown + quiz)
   - `done` event with final `curriculumId`
4. Client redirects to `/dashboard?new=<curriculumId>`

To swap the AI model: set `OLLAMA_MODEL` in `.env.local`. Any OpenAI-compatible endpoint works — just point `OLLAMA_BASE_URL` at it.

---

## Auth

Better Auth handles session management. Session is stored in the `sessions` table.

- `auth.api.getSession({ headers })` is called server-side in the app layout and in tRPC context
- Client-side auth calls go through `apps/web/src/lib/auth-client.ts`
- All Better Auth HTTP routes are at `/api/auth/[...all]`

Do not edit `packages/db/src/schema/users.ts` manually — Better Auth owns that schema shape.

---

## Next.js conventions

- All routes under `apps/web/src/app/(app)/` require a session. The layout at `(app)/layout.tsx` redirects to `/login` if no session is found.
- All API routes and the `(app)/layout.tsx` export `export const dynamic = "force-dynamic"` to prevent Next.js from trying to statically generate pages that hit the database.
- The DB client is lazy-initialized so importing it at build time never throws even if `DATABASE_URL` is absent.

---

## Testing strategy

We follow: **unit tests sparingly for complex logic, integration tests for tRPC boundaries, E2E for main user flows.**

### Unit tests — `packages/api` and `packages/ai`

Runner: **Vitest**. Config: `vitest.config.ts` at each package root.

- `packages/api/tests/quiz-scoring.test.ts` — `scoreQuiz()` pure function: score calculation, pass/fail boundary (70%), per-question feedback
- `packages/ai/tests/schemas.test.ts` — Zod schema validation: `learningProfileSchema`, `curriculumPlanSchema`, `quizQuestionSchema`

Run: `pnpm --filter @bitebase/api test` and `pnpm --filter @bitebase/ai test`

### Integration tests — `packages/api`

Runner: **Vitest** with `vi.mock('@bitebase/db')`.

- `packages/api/tests/curriculum.integration.test.ts` — tRPC router via `appRouter.createCaller()`. Mocks the DB at the module boundary. Tests:
  - Auth guard: every protected procedure throws `UNAUTHORIZED` with no session
  - `curriculum.list`: returns rows / empty array
  - `curriculum.get`: throws `NOT_FOUND` for unknown/other-user ID
  - `curriculum.submitQuiz`: correct → 100% + passed; wrong → 33% + failed; existing progress → `db.update` used; no quiz → `NOT_FOUND`

Mocking pattern: use `vi.hoisted()` for mock objects (avoids the hoisting-before-init error), then pass through the rest of `@bitebase/db` with `importOriginal`. Always add `vi.clearAllMocks()` in `beforeEach` for suites that check call counts.

### E2E tests — `apps/web`

Runner: **Playwright** (Chromium only). Config: `apps/web/playwright.config.ts`. Tests in `apps/web/tests/e2e/`.

The web server auto-starts via `webServer` config. To skip auto-start and use an already-running server:
```bash
SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm --filter @bitebase/web test:e2e
```

**Auth bypass for E2E**: The `(app)/layout.tsx` checks for a cookie `__playwright_test__=1` in non-production environments. If present, it uses a hardcoded mock session (`playwright-test-user`) without hitting the database. Set it via `setTestSession(page)` from `tests/e2e/fixtures.ts`.

**tRPC mocking**: `mockTRPC(page, data)` in `fixtures.ts` intercepts `**/api/trpc*` via `page.route()`. It reads procedure names from query params (`?0.procedure=curriculum.list&batch=1`) and returns correctly shaped JSON.

**AI mocking**: `mockAI(page)` in `fixtures.ts` intercepts `/api/onboarding/chat` (returns a fake SSE stream) and `/api/onboarding/generate` (returns a fake curriculum creation SSE stream).

Test files:
- `tests/e2e/auth.spec.ts` — register form, login form, bad credentials error, landing page CTAs
- `tests/e2e/learning.spec.ts` — dashboard empty/populated, onboarding chat, lesson page, full quiz flow (pass, fail, review answers)

---

## Known sharp edges

**Do not import db at module top level outside the lazy proxy** — the `db` export in `packages/db/src/client.ts` is a `Proxy` that defers the connection. Calling `getDb()` or `postgres()` directly at module scope will fail at build time if `DATABASE_URL` is absent. Use the `db` proxy or call `getDb()` inside a function body.

**`export const dynamic = "force-dynamic"` is required on all Next.js API routes and the app layout** — omitting it causes Next.js to attempt static generation at build time, which triggers the DB connection.

**Do not remove `.js` extensions from internal package imports in the UI package** — TypeScript resolves `.tsx` files without extensions, but adding `.js` was previously broken due to Next.js bundler behavior. The current codebase deliberately omits `.js` extensions in all cross-file imports within packages.

**`@types/react` version** — pinned via `pnpm-workspace.yaml` overrides to `^19.1.4` to avoid conflicts with `react-markdown` and Expo's React 19 requirement.

**Better Auth message roles** — the Vercel AI SDK `useChat` hook doesn't expose `"tool"` in its `UIMessage["role"]` type. Suppress the TypeScript error with `(m.role as any) === "tool"` in the onboarding page; do not try to "fix" this with a type definition change as the SDK type is intentionally narrow.

**Drizzle `where` clauses** — always use `eq()`, `and()`, etc. from `drizzle-orm`. Never use arrow-function predicates (`where((c) => c.id === x)` is wrong).

---

## Deployment

### Docker — local infra only (recommended for active development)

Starts Postgres + Ollama in containers, runs the app natively with `pnpm dev`:

```bash
docker compose up -d          # start postgres + ollama
pnpm db:push                  # sync schema
pnpm dev                      # start the web app

# First-time: pull an Ollama model
docker compose exec ollama ollama pull llama3.2
```

Env vars in `apps/web/.env.local` should point at the local containers:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bitebase
OLLAMA_BASE_URL=http://localhost:11434/v1
```

### Docker — full production stack

Builds the app from source and runs everything in containers:

```bash
# Required: set BETTER_AUTH_SECRET (and optionally TAVILY_API_KEY)
export BETTER_AUTH_SECRET=$(openssl rand -hex 32)

docker compose -f docker-compose.prod.yml up --build

# First-time: pull an Ollama model
docker compose -f docker-compose.prod.yml exec ollama ollama pull llama3.2
```

The `migrate` service runs `drizzle-kit push` before the web service starts. Open http://localhost:3000.

### Docker build details

The `Dockerfile` is a four-stage build:

| Stage | What it does |
|---|---|
| `pruner` | `turbo prune @bitebase/web --docker` — trims the monorepo to only the web app's dependency tree |
| `installer` | Installs deps from the pruned lockfile — this layer is cached as long as `pnpm-lock.yaml` + `package.json` files haven't changed |
| `builder` | Builds the Next.js app (`output: "standalone"`) |
| `runner` | Minimal Alpine image (~200 MB) containing only the standalone output, static assets, and public directory |

Next.js `output: "standalone"` is set in `apps/web/next.config.ts`. It produces a `apps/web/.next/standalone/` directory that includes its own `node_modules` — no pnpm or full workspace needed at runtime.

The built image starts with `node apps/web/server.js`.

### Kubernetes

Reference manifests live in `k8s/`. See `k8s/README.md` for the apply sequence.

Key design decisions:

**Migrations as init container** — the `bitebase-web` Deployment runs `drizzle-kit push` in an init container before the app starts. This keeps deployments atomic — the schema is always up to date before any instance serves traffic. For zero-downtime schema changes, prefer additive migrations (new columns/tables only, never drop while old code is running).

**Health probes** — the `/api/health` endpoint returns `{ status: "ok" }`. Both liveness and readiness probes hit this. If you add database connectivity to the health check in future, keep a separate lightweight liveness probe that doesn't hit the DB (to avoid cascading failures).

**Secrets** — `k8s/secret.yaml` is a template with placeholder values. Never commit real secrets. Recommended approaches: External Secrets Operator (syncs from AWS Secrets Manager / Vault), Sealed Secrets, or SOPS-encrypted secrets in Git.

**Ollama vs external AI** — the `ollama-deployment.yaml` runs Ollama in-cluster. For production on cloud, it's simpler and cheaper to use an external OpenAI-compatible API. Change `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `k8s/configmap.yaml` and delete the Ollama manifests. No code changes needed.

**Streaming responses** — curriculum generation uses SSE and can take >60 seconds. The Ingress has `proxy-read-timeout: 300` and `proxy-send-timeout: 300`. Ensure your load balancer / Ingress controller also increases its timeout, or the stream will be cut off.

**Replicas** — the web Deployment defaults to 2 replicas. The app is stateless (all state in Postgres); scaling horizontally works out of the box. Sessions are stored in the DB, not in-process memory.

---

## Adding a new feature — checklist

1. **Schema change?** Edit `packages/db/src/schema/learning.ts`, then run `pnpm db:push`.
2. **New tRPC procedure?** Add it to `packages/api/src/routers/curriculum.ts` and export any new pure logic into `packages/api/src/lib/`.
3. **New complex pure function?** Add a unit test in `packages/api/tests/`.
4. **New API boundary?** Add an integration test in `packages/api/tests/curriculum.integration.test.ts`.
5. **New user-facing page or flow?** Add an E2E test scenario in `apps/web/tests/e2e/learning.spec.ts` or `auth.spec.ts`.
6. **New AI schema?** Add Zod validation tests in `packages/ai/tests/schemas.test.ts`.
7. **New Next.js API route?** Add `export const dynamic = "force-dynamic"` at the top.
