FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# --------------- Dependencies (cached via lockfile) ---------------
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/chain-event-indexer/package.json apps/chain-event-indexer/package.json
COPY packages/@p2p-me/db/package.json packages/@p2p-me/db/package.json
RUN pnpm install --frozen-lockfile

# --------------- Build @p2p-me/db ---------------
COPY packages/@p2p-me/db/ packages/@p2p-me/db/
RUN pnpm --filter @p2p-me/db run build

# --------------- Build & run chain-event-indexer ---------------
COPY apps/chain-event-indexer/ apps/chain-event-indexer/

# No se cifra .env — usar variables de entorno en el runtime:
#   docker run -e CLOUDFLARE_ACCOUNT_ID=... -e CLOUDFLARE_DATABASE_ID=... -e CLOUDFLARE_API_TOKEN=...
CMD ["pnpm", "--filter", "@chain-event-indexer", "start"]
