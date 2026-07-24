# syntax=docker/dockerfile:1

# Pinned to an exact patch version, not the floating `node:20-bookworm-slim`
# tag, for build reproducibility in general — a floating tag means every
# rebuild could silently pick up a different Node patch. (Note: this was
# originally pinned chasing a Prisma-generator bug that emits ".ts" instead
# of ".js" in relative imports; the pin alone did NOT fix that — see
# scripts/fix-generated-imports.mjs and docs/specs/08 for the real fix and
# why the Node-version theory didn't pan out.)
FROM node:20.19.5-bookworm-slim AS base
WORKDIR /app
# Pin pnpm explicitly — plain `corepack enable` pulls whatever the latest
# pnpm is, and recent pnpm versions require Node 22+ (use the `node:sqlite`
# builtin during dependency resolution), which breaks on this Node 20 image.
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
# better-sqlite3 has no prebuilt binary for this exact platform/arch
# combination, so it falls back to compiling from source (node-gyp), which
# needs python3/make/g++ — none of which are in the slim base image.
# openssl is separately required by @prisma/engines (it detects libssl to
# pick the right query engine build; without it Prisma silently guesses
# and warns).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/*

# prisma.config.ts + prisma/ + scripts/ must be present *before* `pnpm install`
# in both stages below — the postinstall hook runs `prisma generate` (needs
# schema.prisma) followed by scripts/fix-generated-imports.mjs (needs its own
# file to exist to be `require`d at all).

# Full install (incl. devDependencies) so tsc/prisma generate are available for the build.
FROM base AS build
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Separate prod-only install for the runtime image (smaller, no dev tooling).
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile --prod

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma

# Applies any pending migrations against the volume-mounted SQLite file
# before starting the bot — safe to run on every container start since
# `migrate deploy` is a no-op when there's nothing pending.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/index.js"]
