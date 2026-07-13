import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { getCloudflareEnv } from "../shared/env";
import { DATA_DIR } from "../shared/rpc-config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { accountId, databaseId, apiToken } = getCloudflareEnv();

const LOCAL_DB_PATH = path.resolve(DATA_DIR, "scanned-events.db");
const BATCH_SIZE = 100;
const API = "https://api.cloudflare.com/client/v4";

function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function val(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return quote(String(v));
}

async function main() {
  const localDb = new Database(LOCAL_DB_PATH, { readonly: true });

  const rows = localDb
    .prepare(
      `SELECT order_id, user, merchant, recipient_addr, accepted_merchant,
              usdc, fiat, order_type, currency, status,
              created_block, updated_block, block_timestamp, block_timestamp_unix
       FROM orders ORDER BY order_id`,
    )
    .all() as Array<{
    order_id: number;
    user: string;
    merchant: string;
    recipient_addr: string;
    accepted_merchant: string;
    usdc: number;
    fiat: number;
    order_type: string;
    currency: string;
    status: string;
    created_block: number;
    updated_block: number;
    block_timestamp: string;
    block_timestamp_unix: number;
  }>;

  const total = rows.length;
  if (total === 0) {
    console.log("No hay orders en la DB local. Ejecuta 'pnpm run rebuild-orders' primero.");
    return;
  }

  const batches = Math.ceil(total / BATCH_SIZE);
  console.log(
    `Migrando ${total} orders a D1 en ${batches} batches de ${BATCH_SIZE}...`,
  );

  let processed = 0;
  let errors = 0;
  const startTime = Date.now();

  async function sendBatch(orders: typeof rows): Promise<void> {
    const statements: string[] = [];

    for (const o of orders) {
      const id = uuidv4();
      statements.push(
        `INSERT INTO orders (id, order_id, user, merchant, recipient_addr, accepted_merchant, usdc, fiat, order_type, currency, status, created_block, updated_block, block_timestamp, block_timestamp_unix) VALUES (${val(id)}, ${val(o.order_id)}, ${val(o.user)}, ${val(o.merchant)}, ${val(o.recipient_addr)}, ${val(o.accepted_merchant)}, ${val(o.usdc)}, ${val(o.fiat)}, ${val(o.order_type)}, ${val(o.currency)}, ${val(o.status)}, ${val(o.created_block)}, ${val(o.updated_block)}, ${val(o.block_timestamp)}, ${val(o.block_timestamp_unix)}) ON CONFLICT(order_id) DO UPDATE SET merchant=CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.merchant ELSE orders.merchant END, recipient_addr=CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.recipient_addr ELSE orders.recipient_addr END, accepted_merchant=CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.accepted_merchant ELSE orders.accepted_merchant END, usdc=CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.usdc ELSE orders.usdc END, fiat=CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.fiat ELSE orders.fiat END, order_type=CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.order_type ELSE orders.order_type END, currency=CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.currency ELSE orders.currency END, status=CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.status ELSE orders.status END, updated_block=CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.updated_block ELSE orders.updated_block END, block_timestamp=CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.block_timestamp ELSE orders.block_timestamp END, block_timestamp_unix=CASE WHEN orders.updated_block <= excluded.updated_block THEN excluded.block_timestamp_unix ELSE orders.block_timestamp_unix END, updated_at=(CURRENT_TIMESTAMP)`,
      );
    }

    const sql = statements.join(";\n");

    const url = `${API}/accounts/${accountId}/d1/database/${databaseId}/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    });

    const data: any = await res.json();
    if (!data.success) {
      const msg = data.errors?.[0]?.message ?? "unknown";
      console.error(`\n  Error en batch: ${msg}`);
      errors += orders.length;
      return;
    }

    const results = data.result as Array<{ success: boolean; error?: string }>;
    for (let i = 0; i < results.length; i++) {
      if (!results[i].success) {
        console.error(
          `\n  Error en statement ${i}: ${results[i].error ?? "unknown"}`,
        );
        errors++;
      }
    }
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await sendBatch(batch);

    processed += batch.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const pct = ((processed / total) * 100).toFixed(1);
    process.stdout.write(
      `\r  Progreso: ${processed}/${total} (${pct}%) | batch ${Math.floor(i / BATCH_SIZE) + 1}/${batches} | errores: ${errors} | ${elapsed}s     `,
    );
  }

  process.stdout.write("\r");
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nMigracion completada en ${elapsed}s`);
  console.log(`  Total orders: ${total}`);
  console.log(`  Exitosos: ${processed - errors}`);
  console.log(`  Errores: ${errors}`);
}

main().catch(console.error);