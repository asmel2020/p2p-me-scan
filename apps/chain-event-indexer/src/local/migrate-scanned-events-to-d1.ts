import fs from "fs";
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
  const localDb = new Database(LOCAL_DB_PATH);

  const rows = localDb
    .prepare(
      `SELECT order_id, event_name, user_addr, merchant_addr, recipient_addr,
              accepted_merchant, usdc, fiat, order_type, currency,
              block_number, block_timestamp, block_timestamp_unix, tx_hash, log_index
       FROM scanned_events ORDER BY id`,
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
    tx_hash: string;
    log_index: number | null;
  }>;

  const total = rows.length;
  if (total === 0) {
    console.log("No hay eventos pendientes en la DB local.");
    return;
  }

  const batches = Math.ceil(total / BATCH_SIZE);
  console.log(
    `Migrando ${total} eventos a D1 en ${batches} batches de ${BATCH_SIZE}...`,
  );

  let processed = 0;
  let errors = 0;
  const startTime = Date.now();

  async function sendBatch(events: typeof rows): Promise<void> {
    const statements: string[] = [];

    for (const e of events) {
      statements.push(
        `INSERT INTO order_events (id, order_id, event_name, user, merchant, recipient_addr, accepted_merchant, usdc, fiat, order_type, currency, block_number, block_timestamp, block_timestamp_unix, tx_hash, log_index) VALUES (${val(
          uuidv4(),
        )}, ${val(e.order_id)}, ${val(e.event_name)}, ${val(
          e.user_addr,
        )}, ${val(e.merchant_addr)}, ${val(e.recipient_addr)}, ${val(
          e.accepted_merchant,
        )}, ${val(e.usdc)}, ${val(e.fiat)}, ${val(e.order_type)}, ${val(
          e.currency,
        )}, ${e.block_number}, ${val(e.block_timestamp)}, ${
          e.block_timestamp_unix
        }, ${val(e.tx_hash)}, ${val(e.log_index)}) ON CONFLICT(tx_hash, log_index) DO NOTHING`,
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
      errors += events.length;
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
  console.log(`\nMigración completada en ${elapsed}s`);
  console.log(`  Total eventos: ${total}`);
  console.log(`  Exitosos: ${processed - errors}`);
  console.log(`  Errores: ${errors}`);

  /* Actualizar processorState */
  const stateRow = localDb
    .prepare("SELECT last_block FROM scanner_state WHERE id = 1")
    .get() as { last_block: number } | undefined;

  if (stateRow) {
    const lastBlock = stateRow.last_block;
    const stateSql = `INSERT INTO processor_state (id, last_block) VALUES (1, ${lastBlock}) ON CONFLICT(id) DO UPDATE SET last_block=excluded.last_block, updated_at=(CURRENT_TIMESTAMP)`;
    const url = `${API}/accounts/${accountId}/d1/database/${databaseId}/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: stateSql }),
    });
    const data: any = await res.json();
    if (data.success) {
      console.log(`  processorState actualizado: último bloque = ${lastBlock}`);
    } else {
      console.error(
        `  Error al actualizar processorState: ${data.errors?.[0]?.message ?? "unknown"}`,
      );
    }
  }
}

main().catch(console.error);
