# BiteBase

An interactive micro-learning tutor that swaps doomscrolling for bite-sized growth. Tell it what to learn, and it builds a playful, quiz-filled curriculum tailored just for you.

<p align="center">
  <img src="screenshots/landing.jpg" width="75%" alt="BiteBase landing page — hero section with tagline and call-to-action" />
</p>

<p align="center">
  <img src="screenshots/explore.png" width="49%" alt="Community curriculum library — browse and discover lessons created by others" />
  <img src="screenshots/onboarding.png" width="49%" alt="Onboarding chat — tell BiteBase what you'd like to learn" />
</p>

## Stack

| Layer | Tech |
|-------|------|
| Monorepo | Turborepo + pnpm workspaces |
| Web | Next.js 15 (App Router) |
| Mobile | Expo SDK 56 (React Native) |
| Styling | Tailwind CSS + NativeWind |
| API | tRPC v11 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better Auth |
| AI | Vercel AI SDK → Ollama (local, OpenAI-compatible) |
| Web search | Tavily API |

## Getting started

Choose the setup that matches your workflow.

---

### Option A — Docker (recommended, zero local dependencies)

Starts Postgres + Ollama in containers and runs the app natively.

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Install JS deps and sync the schema
pnpm install
pnpm db:push

# 3. Pull an AI model (first time only — ~2 GB download)
docker compose exec ollama ollama pull llama3.2

# 4. Copy env and start the app
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

`apps/web/.env.local` already has the right defaults for the Docker services. Open [http://localhost:3000](http://localhost:3000).

---

### Option B — Native (everything runs on your machine)

#### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 14+ running locally
- [Ollama](https://ollama.ai) installed and running

#### Steps

```bash
# 1. Clone and install
git clone <repo>
cd bitebase
pnpm install

# 2. Configure environment
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bitebase

# Generate with: openssl rand -hex 32
BETTER_AUTH_SECRET=your-32-char-secret-here
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000

OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2

# Optional — enables web search during lesson generation
TAVILY_API_KEY=tvly-your-key-here
```

```bash
# 3. Create database and sync schema
createdb bitebase
pnpm db:push

# 4. Pull a model and start Ollama
ollama pull llama3.2
ollama serve

# 5. Start the web app
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

### Mobile app (optional)

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
# Set EXPO_PUBLIC_API_URL=http://<your-local-ip>:3000

pnpm --filter @bitebase/mobile start
```

Scan the QR code with Expo Go.

---

### Full Docker stack (production-like)

Builds and runs everything in containers — useful for staging or smoke-testing the production build:

```bash
export BETTER_AUTH_SECRET=$(openssl rand -hex 32)
docker compose -f docker-compose.prod.yml up --build

# First time — pull the model
docker compose -f docker-compose.prod.yml exec ollama ollama pull llama3.2
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
bitebase/
├── apps/
│   ├── web/              # Next.js 15 web app
│   └── mobile/           # Expo React Native app
├── packages/
│   ├── ai/               # Vercel AI SDK config, prompts, Zod schemas
│   ├── api/              # tRPC router + Better Auth
│   ├── db/               # Drizzle ORM + PostgreSQL schema
│   └── ui/               # Shared UI components
└── turbo.json
```

## How it works

1. **Onboarding** — Chat with BiteBase. It asks about your topic, experience level, goals, and available time.
2. **Curriculum generation** — The AI generates a structured lesson plan with sections and subsections.
3. **Content generation** — For each subsection, the AI optionally searches the web (Tavily), then writes a markdown lesson and a quiz.
4. **Learning** — Work through lessons in order. Each lesson is unlocked after passing the previous quiz (≥70%).
5. **Progress** — Your scores, streaks, and completion are tracked per user.

## Swapping models

Set `OLLAMA_MODEL` in `.env.local` to any model Ollama supports:

```env
OLLAMA_MODEL=mistral
OLLAMA_MODEL=gemma3
OLLAMA_MODEL=deepseek-r1
```

Any OpenAI-compatible API works too — just set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` accordingly.
