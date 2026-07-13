# P2P.me Scan

A full-stack monorepo that indexes peer-to-peer (P2P) order events from the **Base Mainnet** blockchain and exposes a REST API and web UI for querying them. Tracks orders placed on the [p2p.me](https://p2p.me/) platform, including status transitions (placed, accepted, paid, completed, cancelled), amounts (USDC/fiat), currencies, and on-chain metadata.

## Architecture

```
┌──────────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Chain Event     │────▶│  Cloudflare  │────▶│  P2P API         │
│  Indexer         │     │  D1 (SQLite) │     │  (CF Worker)     │
│  (Node.js/Docker)│     │              │     │  Hono + Drizzle  │
└──────────────────┘     └──────────────┘     └──────────────────┘
       │                                              │
       │ (viem + Base RPC)                            │ (HTTP)
       ▼                                              ▼
  Base Mainnet                                 ┌──────────────────┐
  (0x4cad6e... Diamond Proxy)                  │  P2P.me Scan     │
                                               │  (React + Vite)  │
                                               └──────────────────┘
```

## Repository Structure

```
p2p-me-scan/
├── .env.example                        # Environment variable template
├── pnpm-workspace.yaml                 # Workspace config
├── turbo.json                          # Turborepo pipeline
├── package.json                        # Root package (pnpm workspace)
│
├── apps/
│   ├── chain-event-indexer/            # On-chain event indexer (Node.js)
│   │   ├── Dockerfile                  # Docker image for production
│   │   └── src/
│   │       ├── server/                 # Main indexer entry, block poller, catchup
│   │       ├── shared/                 # Events, RPC config, DB client, env
│   │       └── local/                  # Utility scripts (scan, migrate, rebuild)
│   │
│   ├── p2p-api/                        # REST API (Cloudflare Worker)
│   │   ├── wrangler.jsonc              # Wrangler config
│   │   └── src/
│   │       ├── application/            # Business logic / services
│   │       ├── presentation/           # Routes, validation, helpers
│   │       └── index.ts                # Entry point
│   │
│   └── p2pme-scan/                     # Frontend web app (React + Vite)
│       ├── vite.config.ts
│       └── src/
│           ├── features/               # Orders, Analytics pages
│           ├── components/             # UI primitives, shared components
│           ├── api/                    # HTTP client, API functions
│           └── routes/                 # TanStack Router route tree
│
└── packages/
    └── @p2p-me/
        └── db/                         # Shared database package
            ├── drizzle.config.ts       # Drizzle Kit config
            ├── drizzle/                # Migration files
            └── src/
                ├── schema.ts           # Drizzle schema (orders, orderEvents, processorState)
                └── client.ts           # D1 client factory
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm |
| DB | Cloudflare D1 (SQLite via Drizzle ORM) |
| API | Hono (Cloudflare Workers) |
| Blockchain | viem (Base Mainnet RPC) |
| Frontend | React 19 + Vite + TanStack Router + React Query |
| Styling | Tailwind CSS v4 + @base-ui/react |
| Charts | lightweight-charts (TradingView) |
| Linter | oxlint |
| Formatting | Prettier |
| CI/CD | GitHub Actions (Wrangler, Docker, CapRover) |

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- **Cloudflare account** with:
  - D1 database created
  - API Token with **D1 → Write** permission
- **Base Mainnet RPC access** (public endpoints included, private recommended for production)

## Environment Variables

Create a `.env` file in the **project root** (see `.env.example`):

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_DATABASE_ID=your_database_id
CLOUDFLARE_API_TOKEN=your_api_token
VITE_API_URL=http://localhost:8787/v1
```

| Variable | Purpose | Used By |
|----------|---------|---------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | Indexer, DB migrations |
| `CLOUDFLARE_DATABASE_ID` | D1 database ID | Indexer, DB migrations |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (D1 Write) | Indexer, DB migrations |
| `VITE_API_URL` | API base URL (frontend) | Frontend (default: `http://localhost:8787/v1`) |

The `.env` file is in `.gitignore` and is **not** committed.

## Setup

```sh
pnpm install
pnpm build
```

## Database Migrations

Migrations are managed via Drizzle Kit in the `@p2p-me/db` package. `drizzle.config.ts` loads env vars from the root `.env` automatically.

### Generate a new migration (after schema changes)

```sh
pnpm --filter @p2p-me/db db:generate
```

### Apply migrations to D1

```sh
pnpm --filter @p2p-me/db db:migrate
```

---

## Chain Event Indexer

Node.js service that indexes events from the Base Mainnet Diamond Proxy contract (`0x4cad6eC90e65baBec9335cAd728DDC610c316368`) and persists them to Cloudflare D1 via the Cloudflare API v4.

**Indexed events:** `OrderPlaced`, `OrderAccepted`, `BuyOrderPaid`, `OrderCompleted`, `CancelledOrders`

### Features

- **Fast historical catchup** — parallel chunked processing across multiple RPC endpoints with configurable concurrency
- **Live block polling** — polls every 2 seconds for new blocks
- **Semaphore-based RPC concurrency** — per-endpoint rate limiting with exponential backoff
- **Automatic RPC failover** — retries with different endpoints on errors
- **Resumable** — tracks last indexed block in `processor_state` table

### Development

```sh
cd apps/chain-event-indexer
pnpm dev        # tsx watch src/server/index.ts
```

### Local Utility Scripts

```sh
pnpm scan              # Scan blocks to local SQLite
pnpm block-stats       # Compute block range statistics
pnpm check-blocks      # Check events in a block range
pnpm reprocess-failed  # Retry failed blocks
pnmp fix-timestamps    # Fix missing timestamps in D1
pnpm migrate-timestamps # Migrate block timestamps to D1
pnpm rebuild-orders    # Rebuild orders table from local events
pnpm migrate-events    # Migrate scanned events to D1
pnpm migrate-orders    # Migrate orders to D1
```

### Production (Docker)

```sh
docker build -t p2p-indexer ./apps/chain-event-indexer
docker run -e CLOUDFLARE_ACCOUNT_ID=your_id \
           -e CLOUDFLARE_DATABASE_ID=your_db \
           -e CLOUDFLARE_API_TOKEN=your_token \
           p2p-indexer
```

The indexer makes outbound connections only (Base RPC + Cloudflare API) and does not expose any ports.

---

## P2P API

REST API deployed on Cloudflare Workers, built with Hono following a DDD-inspired structure.

### Development

```sh
cd apps/p2p-api
pnpm dev        # wrangler dev --remote
```

### Deploy

```sh
pnpm deploy:api
# or
cd apps/p2p-api && pnpm deploy
```

---

## P2P.me Scan (Frontend)

React + Vite web application built with TanStack Router, React Query, and Tailwind CSS v4.

### Development

```sh
cd apps/p2pme-scan
pnpm dev        # vite (default: http://localhost:5173)
```

### Build for Production

```sh
cd apps/p2pme-scan
pnpm build      # tsc -b && vite build
```

### Preview Build

```sh
pnpm preview    # vite preview
```

---

## API Endpoints

All routes are under `/v1`.

### `GET /v1/status`

Health check.

```json
{ "status": "ok", "service": "p2p-api", "version": "v1" }
```

---

### `GET /v1/orders`

List orders with cursor-based pagination. Sorted by `orderId` descending (newest first).

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | — | Pagination cursor (base64) |
| `limit` | number | 20 | Items per page (max 100) |
| `status` | enum | — | `placed`, `accepted`, `paid`, `completed`, `cancelled` |
| `currency` | string | — | Filter by currency (e.g. `USD`) |
| `orderType` | enum | — | `BUY`, `SELL`, `RENT` |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "orderId": "0x...",
      "user": "0x...",
      "merchant": "0x...",
      "recipientAddr": "0x...",
      "acceptedMerchant": "0x...",
      "usdc": 100.0,
      "fiat": 100.0,
      "orderType": "BUY",
      "currency": "USD",
      "status": "placed",
      "createdBlock": 12345,
      "updatedBlock": 12345,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "nextCursor": "eyJvIjoiMHgxMjMifQ=="
}
```

`nextCursor` is `null` when there are no more pages.

---

### `GET /v1/orders/:orderId`

Order detail with all its events.

```json
{
  "id": "uuid",
  "orderId": "0x...",
  "...": "...",
  "events": [
    {
      "id": "uuid",
      "orderId": "0x...",
      "eventName": "OrderPlaced",
      "blockNumber": 12345,
      "logIndex": 0,
      "txHash": "0x..."
    }
  ]
}
```

---

### `GET /v1/orders/:orderId/events`

Events for a specific order.

```json
{
  "orderId": "0x...",
  "events": [...],
  "total": 5
}
```

---

### `GET /v1/events`

List events with cursor-based pagination. Sorted by `blockNumber DESC, logIndex DESC`.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | — | Pagination cursor (base64) |
| `limit` | number | 20 | Items per page (max 100) |
| `eventName` | enum | — | `OrderPlaced`, `OrderAccepted`, `BuyOrderPaid`, `OrderCompleted`, `CancelledOrders` |
| `orderId` | string | — | Filter by order ID |
| `fromBlock` | number | — | Start block (inclusive) |
| `toBlock` | number | — | End block (inclusive) |

**Response:**

```json
{
  "data": [...],
  "nextCursor": "eyJiIjoxMjM0NSwibCI6MH0="
}
```

---

### `GET /v1/stats`

Aggregated statistics.

```json
{
  "orders": 150,
  "events": 520,
  "byStatus": [
    { "status": "placed", "total": 80 }
  ],
  "byCurrency": [
    { "currency": "USD", "totalUsdc": 5000, "totalFiat": 5000, "count": 50 }
  ]
}
```

---

### `GET /v1/analytics/daily-transferability`

Daily volume analytics.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | string (ISO date) | — | Start date (inclusive) |
| `to` | string (ISO date) | — | End date (inclusive) |

**Response:**

```json
{
  "data": [
    {
      "date": "2026-01-01",
      "totalUsdc": 50000,
      "totalOrders": 42
    }
  ]
}
```

---

## Cursor Pagination

Both `/v1/orders` and `/v1/events` use cursor-based pagination:

1. First request without `cursor`
2. Response includes `nextCursor` (base64 string)
3. Next page: `?cursor=eyJvIjoi...`
4. `nextCursor: null` = no more data

Internal cursor structure (base64-encoded JSON):
- **Orders**: `{ "o": "orderId" }`
- **Events**: `{ "b": blockNumber, "l": logIndex }`

### Examples

```sh
# First page of orders
curl "https://p2p-api.your-domain.workers.dev/v1/orders?limit=10"

# Second page
curl "https://p2p-api.your-domain.workers.dev/v1/orders?cursor=eyJvIjoiMHgxMjMifQ==&limit=10"

# Filter by status
curl "https://p2p-api.your-domain.workers.dev/v1/orders?status=placed"

# Events from recent blocks
curl "https://p2p-api.your-domain.workers.dev/v1/events?fromBlock=1000000"

# Stats
curl "https://p2p-api.your-domain.workers.dev/v1/stats"
```

---

## CI/CD

Three GitHub Actions workflows handle deployment:

### 1. API (`deploy-api.yml`)
- **Trigger:** Push to `master` (changes in `apps/p2p-api/**`, `packages/**`)
- **Action:** Runs `wrangler deploy` to publish the Cloudflare Worker
- **Secrets:** `CLOUDFLARE_API_TOKEN`

### 2. Frontend (`deploy-p2pme-scan.yml`)
- **Trigger:** Push to `master` (changes in `apps/p2pme-scan/**`, `packages/**`)
- **Action:** Builds with `VITE_API_URL` from secrets, deploys to **Cloudflare Pages**
- **Secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VITE_API_URL`

### 3. Chain Event Indexer (`chain-event-indexer.yml`)
- **Trigger:** Push to `master` (changes in `apps/chain-event-indexer/**`)
- **Action:** Builds Docker image, pushes to **GitHub Container Registry (GHCR)**, deploys to **CapRover**
- **Secrets:** `TOKEN_GITHUB`, `APP_SERVER`, `APP_NAME_INDEXER`, `APP_TOKEN_INDEXER`

---

## Linting & Type Checking

```sh
pnpm lint          # Turbo: runs tsc --noEmit across all packages
pnpm check-types   # Turbo: runs TypeScript checks
pnpm format        # Prettier --write "**/*.{ts,tsx,md}"
# Frontend-specific:
cd apps/p2pme-scan && pnpm lint   # oxlint
```

## Smart Contract

**Diamond Proxy:** `0x4cad6eC90e65baBec9335cAd728DDC610c316368` (Base Mainnet)

**ABI events:**
- `OrderPlaced`
- `OrderAccepted`
- `BuyOrderPaid`
- `OrderCompleted`
- `CancelledOrders`

## Database Schema

Three tables managed by Drizzle ORM:

- **`orders`** — Current state of each order (unique by `orderId`)
- **`order_events`** — Full event history (unique by `txHash` + `logIndex`)
- **`processor_state`** — Tracks last indexed block for resumability
