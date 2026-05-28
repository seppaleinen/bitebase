# BiteBase

An interactive micro-learning tutor that swaps doomscrolling for bite-sized growth. Tell it what to learn, and it builds a playful, quiz-filled curriculum tailored just for you. Level up your brain!

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

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL running locally (or via Docker)
- [Ollama](https://ollama.ai) running with a model pulled (e.g. `ollama pull llama3.2`)

### 1. Clone and install

```bash
git clone <repo>
cd bitebase
pnpm install
```

### 2. Configure environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bitebase

# Better Auth (generate with: openssl rand -hex 32)
BETTER_AUTH_SECRET=your-32-char-secret-here
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000

# Ollama (local AI — must be running)
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2

# Tavily (optional — enables web search for lesson content)
TAVILY_API_KEY=tvly-your-key-here
```

### 3. Set up the database

Create the database and run migrations:

```bash
createdb bitebase
pnpm db:push
```

### 4. Start Ollama

```bash
ollama serve
ollama pull llama3.2   # or any OpenAI-compatible model
```

### 5. Start the web app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Start the mobile app (optional)

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
# Set EXPO_PUBLIC_API_URL=http://<your-local-ip>:3000

pnpm --filter @bitebase/mobile start
```

Then scan the QR code with Expo Go.

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
