import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { getCloudflareEnv } from "../shared/env";
import { DATA_DIR } from "../shared/rpc-config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { accountId, databaseId, apiToken } = getCloudflareEnv();

const LOCAL_DB_PATH = path.resolve(DATA_DIR, "block-timestamps.db");
const BATCH_SIZE = 200;
const API = "https://api.cloudflare.com/client/v4";

function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

async function main() {
  const localDb = new Database(LOCAL_DB_PATH);

  const rows = localDb.prepare(
    "SELECT block_number, block_timestamp, block_timestamp_unix FROM block_timestamps ORDER BY block_number"
  ).all() as { block_number: number; block_timestamp: string; block_timestamp_unix: number }[];

  const total = rows.length;
  if (total === 0) {
    console.log("No hay registros pendientes en la DB local.");
    return;
  }

  const batches = Math.ceil(total / BATCH_SIZE);
  console.log(`Migrando ${total} registros a D1 en ${batches} batches de ${BATCH_SIZE}...`);

  let processed = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const whenTs = batch.map((r) => `WHEN ${r.block_number} THEN ${quote(r.block_timestamp)}`).join(" ");
    const whenUnix = batch.map((r) => `WHEN ${r.block_number} THEN ${r.block_timestamp_unix}`).join(" ");
    const inList = batch.map((r) => `${r.block_number}`).join(",");

    const sql = `UPDATE order_events SET block_timestamp = CASE block_number ${whenTs} END, block_timestamp_unix = CASE block_number ${whenUnix} END WHERE block_number IN (${inList})`;

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
      console.error(`\n  Error en batch ${Math.floor(i / BATCH_SIZE) + 1}: ${msg}`);
      errors += batch.length;
    }

    processed += batch.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const pct = ((processed / total) * 100).toFixed(1);
    process.stdout.write(`\r  Progreso: ${processed}/${total} (${pct}%) | batch ${Math.floor(i / BATCH_SIZE) + 1}/${batches} | errores: ${errors} | ${elapsed}s     `);
  }

  process.stdout.write("\r");
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nMigración completada en ${elapsed}s`);
  console.log(`  Total: ${total}`);
  console.log(`  Exitosos: ${processed - errors}`);
  console.log(`  Errores: ${errors}`);
}

main().catch(console.error);
