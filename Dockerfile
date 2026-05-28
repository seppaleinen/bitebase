# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# BiteBase — multi-stage Docker build for the Next.js web app
#
# Stages:
#   base      → Node 20 + pnpm + turbo
#   pruner    → prune the monorepo to only the web app's dependency tree
#   installer → install deps from pruned lockfile (layer-cached separately)
#   builder   → compile the app
#   runner    → minimal production image (~200 MB)
#
# Build args (all optional at build time — can be set at runtime via env):
#   DATABASE_URL, BETTER_AUTH_SECRET, etc.
#   Only NEXT_PUBLIC_* vars must be baked in at build time.
# ─────────────────────────────────────────────────────────────────────────────

# ── base ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN npm install -g pnpm@11.4.0 turbo

# ── pruner ────────────────────────────────────────────────────────────────────
FROM base AS pruner
WORKDIR /app
COPY . .
# Creates out/json (package.json only) and out/full (full source) for caching
RUN turbo prune @bitebase/web --docker

# ── installer ─────────────────────────────────────────────────────────────────
FROM base AS installer
WORKDIR /app

# Copy only the package manifests first — this layer is cached as long as
# no package.json or pnpm-lock.yaml changes.
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/full/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Re-copy node_modules from the installer stage, then layer the full source on top
COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# DATABASE_URL is not needed at build time (client is lazy-initialised).
# If you use NEXT_PUBLIC_* vars they must be ARGs here:
# ARG NEXT_PUBLIC_SOMETHING
# ENV NEXT_PUBLIC_SOMETHING=$NEXT_PUBLIC_SOMETHING

RUN pnpm --filter @bitebase/web build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js standalone output — self-contained node server
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Static assets (CSS, JS chunks, images)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static      ./apps/web/.next/static
# Public directory
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public             ./apps/web/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# The standalone build produces server.js at the monorepo-root level inside the
# standalone directory, but the actual entry is scoped to the app path:
CMD ["node", "apps/web/server.js"]
