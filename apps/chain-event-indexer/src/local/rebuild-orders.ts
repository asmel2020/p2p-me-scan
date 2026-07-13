import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import "../shared/env";
import { DATA_DIR } from "../shared/rpc-config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.resolve(DATA_DIR, "scanned-events.db");

const EVENT_STATUS_MAP: Record<string, string> = {
  OrderPlaced: "placed",
  OrderAccepted: "accepted",
  BuyOrderPaid: "paid",
  OrderCompleted: "completed",
  CancelledOrders: "cancelled",
};

const localDb = new Database(LOCAL_DB_PATH);
localDb.pragma("journal_mode = WAL");

localDb.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    order_id INTEGER PRIMARY KEY,
    user TEXT NOT NULL DEFAULT '-',
    merchant TEXT NOT NULL DEFAULT '-',
    recipient_addr TEXT NOT NULL DEFAULT '-',
    accepted_merchant TEXT NOT NULL DEFAULT '-',
    usdc REAL NOT NULL DEFAULT 0,
    fiat REAL NOT NULL DEFAULT 0,
    order_type TEXT NOT NULL DEFAULT '-',
    currency TEXT NOT NULL DEFAULT '-',
    status TEXT NOT NULL DEFAULT 'placed',
    created_block INTEGER NOT NULL,
    updated_block INTEGER NOT NULL,
    block_timestamp TEXT NOT NULL DEFAULT '',
    block_timestamp_unix INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

const upsertOrder = localDb.prepare(`
  INSERT INTO orders (
    order_id, user, merchant, recipient_addr, accepted_merchant,
    usdc, fiat, order_type, currency, status,
    created_block, updated_block, block_timestamp, block_timestamp_unix
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(order_id) DO UPDATE SET
    merchant = CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.merchant ELSE orders.merchant END,
    recipient_addr = CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.recipient_addr ELSE orders.recipient_addr END,
    accepted_merchant = CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.accepted_merchant ELSE orders.accepted_merchant END,
    usdc = CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.usdc ELSE orders.usdc END,
    fiat = CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.fiat ELSE orders.fiat END,
    order_type = CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.order_type ELSE orders.order_type END,
    currency = CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.currency ELSE orders.currency END,
    status = CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.status ELSE orders.status END,
    updated_block = CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.updated_block ELSE orders.updated_block END,
    block_timestamp = CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.block_timestamp ELSE orders.block_timestamp END,
    block_timestamp_unix = CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.block_timestamp_unix ELSE orders.block_timestamp_unix END,
    updated_at = datetime('now')
`);

async function main() {
  const totalEvents = (
    localDb.prepare("SELECT COUNT(*) as c FROM scanned_events").get() as { c: number }
  ).c;

  if (totalEvents === 0) {
    console.log("No hay eventos en scanned_events. Ejecuta 'pnpm scan' primero.");
    return;
  }

  console.log(`Reconstruyendo orders desde ${totalEvents} eventos...`);

  localDb.exec("DELETE FROM orders");

  const events = localDb
    .prepare(
      `SELECT order_id, event_name, user_addr, merchant_addr, recipient_addr,
              accepted_merchant, usdc, fiat, order_type, currency,
              block_number, block_timestamp, block_timestamp_unix
       FROM scanned_events
       ORDER BY block_number ASC, log_index ASC`,
    )
    .all() as Array<{
    order_id: number;
    event_name: string;
    user_addr: string;
    merchant_addr: string;
    recipient_addr: string;
    accepted_merchant: string;
    usdc: number;
    fiat: number;
    order_type: string;
    currency: string;
    block_number: number;
    block_timestamp: string;
    block_timestamp_unix: number;
  }>;

  let processed = 0;
  let skipped = 0;
  const uniqueOrders = new Set<number>();
  const startTime = Date.now();

  const BATCH = 5000;
  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);
    const tx = localDb.transaction((rows: typeof events) => {
      for (const e of rows) {
        const status = EVENT_STATUS_MAP[e.event_name] ?? "unknown";
        const before = (
          localDb
            .prepare("SELECT updated_block FROM orders WHERE order_id = ?")
            .get(e.order_id) as { updated_block: number } | undefined
        );

        upsertOrder.run(
          e.order_id,
          e.user_addr,
          e.merchant_addr,
          e.recipient_addr,
          e.accepted_merchant,
          e.usdc,
          e.fiat,
          e.order_type,
          e.currency,
          status,
          e.block_number,
          e.block_number,
          e.block_timestamp,
          e.block_timestamp_unix,
        );

        if (before && before.updated_block > e.block_number) {
          skipped++;
        } else {
          uniqueOrders.add(e.order_id);
        }

        processed++;
      }
    });
    tx(batch);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const pct = ((processed / totalEvents) * 100).toFixed(1);
    process.stdout.write(
      `\r  Eventos: ${processed}/${totalEvents} (${pct}%) | Ordenes: ${uniqueOrders.size} | Retrazados: ${skipped} | ${elapsed}s   `,
    );
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\nCompletado en ${elapsed}s`);
  console.log(`  Total eventos procesados: ${processed}`);
  console.log(`  Eventos retrazados (ignorados): ${skipped}`);
  console.log(`  Ordenes unicas: ${uniqueOrders.size}`);

  const statusCounts = localDb
    .prepare("SELECT status, COUNT(*) as c FROM orders GROUP BY status ORDER BY c DESC")
    .all() as { status: string; c: number }[];

  console.log(`\n  Distribucion por status:`);
  for (const { status, c } of statusCounts) {
    console.log(`    ${status}: ${c}`);
  }

  console.log(`\nDB local: ${LOCAL_DB_PATH}`);
  console.log(`Para migrar a D1: pnpm run migrate-orders`);
}

main().catch(console.error);