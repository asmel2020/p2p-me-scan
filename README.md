# P2P Me Scan

Monorepo que indexa eventos de órdenes P2P en Base Mainnet y expone una API para consultarlas.

## Stack

- **Runtime**: Node.js (package manager: pnpm)
- **Base de datos**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **API**: Hono (Cloudflare Workers)
- **Indexer**: Node.js + viem (escucha Base Mainnet)
- **Monorepo**: Turborepo

## Estructura

```
p2p-me-scan/
├── .env                          # Variables de entorno (raíz)
├── apps/
│   ├── chain-event-indexer/      # Indexer de eventos on-chain (Node.js)
│   └── p2p-api/                  # API REST (Cloudflare Worker)
├── packages/
│   └── @p2p-me/
│       └── db/                   # Schema Drizzle compartido + cliente D1
├── turbo.json
└── pnpm-workspace.yaml
```

## Prerrequisitos

- Node.js >= 18
- pnpm >= 9
- Cuenta de Cloudflare con D1
- Acceso a RPC de Base Mainnet

## Variables de Entorno

Crear archivo `.env` en la **raíz del proyecto**:

```env
CLOUDFLARE_ACCOUNT_ID=tu_account_id
CLOUDFLARE_DATABASE_ID=tu_database_id
CLOUDFLARE_API_TOKEN=tu_api_token
```

Estas vars son usadas por todos los servicios del monorepo. El `.env` ya está en `.gitignore`.

### Permisos del API Token

El `CLOUDFLARE_API_TOKEN` debe tener el permiso **D1 → Write** en Cloudflare:

| Recurso | Permiso | Motivo |
|---------|---------|--------|
| `Cloudflare D1` | `Write` | Ejecutar queries y migraciones contra la D1 |

Si usás un API Token restringido a una base de datos específica, asegurate de seleccionar la `database_id` correcta en los permisos del token. No es necesario acceso a ningún otro recurso de Cloudflare.

## Setup

```sh
pnpm install
pnpm build
```

## Migraciones de Base de Datos

Las migraciones se manejan con Drizzle Kit en el paquete `@p2p-me/db`.  
El `drizzle.config.ts` carga automáticamente las variables del `.env` raíz.

### Generar nueva migración (tras cambiar schema)

```sh
pnpm --filter @p2p-me/db db:generate
```

### Aplicar migraciones a D1

```sh
pnpm --filter @p2p-me/db db:migrate
```

## Chain Event Indexer

Indexador que escucha la Blockchain Base Mainnet por eventos del contrato Diamond Proxy (`0x4cad6eC90e65baBec9335cAd728DDC610c316368`) y los persiste en D1.

**Eventos indexados:** OrderPlaced, OrderAccepted, BuyOrderPaid, OrderCompleted, CancelledOrders

### Desarrollo

```sh
cd apps/chain-event-indexer
pnpm dev          # auto-reload con tsx
```

### Producción con Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build
CMD ["node", "dist/index.js"]
```

Las variables de entorno se pasan al contenedor (no se usa `.env` en producción):

```sh
docker run -e CLOUDFLARE_ACCOUNT_ID=tu_id \
           -e CLOUDFLARE_DATABASE_ID=tu_db \
           -e CLOUDFLARE_API_TOKEN=tu_token \
           p2p-indexer
```

El indexer no expone puertos, solo hace conexiones salientes (RPC Base + API Cloudflare).

## P2P API

API REST desplegada en Cloudflare Workers con Hono y estructura DDD.

```
src/
├── index.ts                   # Entry point
├── app.ts                     # Bootstrap, CORS, monta rutas bajo /v1
├── application/
│   ├── orders.service.ts      # Use cases: getOrders, getOrder, getOrderEvents
│   └── events.service.ts      # Use case: getEvents
└── presentation/
    ├── schemas.ts             # Validación Zod
    ├── helpers/
    │   └── cursor.ts          # encodeCursor / decodeCursor (base64)
    └── routes/
        ├── orders.ts          # GET /v1/orders, /v1/orders/:id, /v1/orders/:id/events
        ├── events.ts          # GET /v1/events
        └── stats.ts           # GET /v1/stats
```

### Desarrollo local

```sh
cd apps/p2p-api
pnpm dev        # wrangler dev --remote
```

### Deploy

```sh
pnpm deploy:api
# o
cd apps/p2p-api && pnpm deploy
```

---

## Endpoints

Todas las rutas bajo `/v1`.

### `GET /v1/status`

Health check.

```json
{ "status": "ok", "service": "p2p-api", "version": "v1" }
```

---

### `GET /v1/orders`

Lista órdenes con paginación por cursor. Ordenadas por `orderId` descendente (más reciente primero).

**Query params:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `cursor` | string | - | Cursor de paginación (base64) |
| `limit` | number | 20 | Items por página (max 100) |
| `status` | enum | - | `placed`, `accepted`, `paid`, `completed`, `cancelled` |
| `currency` | string | - | Filtrar por moneda (ej: `USD`) |
| `orderType` | enum | - | `BUY`, `SELL`, `RENT` |

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

El `nextCursor` es `null` cuando no hay más páginas.

---

### `GET /v1/orders/:orderId`

Detalle de una orden + todos sus eventos.

```json
{
  "id": "uuid",
  "orderId": "0x...",
  ...
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

Eventos de una orden específica.

```json
{
  "orderId": "0x...",
  "events": [...],
  "total": 5
}
```

---

### `GET /v1/events`

Lista eventos con paginación por cursor. Ordenados por `blockNumber DESC, logIndex DESC`.

**Query params:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `cursor` | string | - | Cursor de paginación (base64) |
| `limit` | number | 20 | Items por página (max 100) |
| `eventName` | enum | - | `OrderPlaced`, `OrderAccepted`, `BuyOrderPaid`, `OrderCompleted`, `CancelledOrders` |
| `orderId` | string | - | Filtrar por order ID |
| `fromBlock` | number | - | Bloque inicial (inclusive) |
| `toBlock` | number | - | Bloque final (inclusive) |

**Response:**

```json
{
  "data": [...],
  "nextCursor": "eyJiIjoxMjM0NSwibCI6MH0="
}
```

---

### `GET /v1/stats`

Estadísticas agregadas.

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

## Paginación por Cursor

`/orders` y `/events` usan cursor-based pagination:

1. Primera request sin `cursor`
2. Respuesta incluye `nextCursor` (string base64)
3. Siguiente página: `?cursor=eyJvIjoi...`
4. `nextCursor: null` = no hay más datos

Cursor interno (codificado en base64):
- **Orders**: `{ "o": "orderId" }`
- **Events**: `{ "b": blockNumber, "l": logIndex }`

### Ejemplos con curl

```sh
# Primera página de órdenes
curl "https://p2p-api.tudominio.workers.dev/v1/orders?limit=10"

# Segunda página
curl "https://p2p-api.tudominio.workers.dev/v1/orders?cursor=eyJvIjoiMHgxMjMifQ==&limit=10"

# Filtrar por status
curl "https://p2p-api.tudominio.workers.dev/v1/orders?status=placed"

# Eventos de los últimos bloques
curl "https://p2p-api.tudominio.workers.dev/v1/events?fromBlock=1000000"

# Stats
curl "https://p2p-api.tudominio.workers.dev/v1/stats"
```
