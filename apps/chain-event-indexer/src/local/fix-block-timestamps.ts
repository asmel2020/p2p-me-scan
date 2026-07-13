import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { initRemoteDB } from "@p2p-me/db/client";
import * as schema from "@p2p-me/db";
import { RPC_CONFIG, RPC_URLS, createClient, logRpcError, LOG_FILE, DATA_DIR } from "../shared/rpc-config";
import { getCloudflareEnv } from "../shared/env";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.resolve(DATA_DIR, "block-timestamps.db");

const { accountId, databaseId, apiToken } = getCloudflareEnv();

/* -------------------------------------------------------------------------- */
/*  Local SQLite                                                               */
/* -------------------------------------------------------------------------- */

const localDb = new Database(LOCAL_DB_PATH);
localDb.pragma("journal_mode = WAL");
localDb.exec(`
  CREATE TABLE IF NOT EXISTS block_timestamps (
    block_number INTEGER PRIMARY KEY,
    block_timestamp TEXT NOT NULL,
    block_timestamp_unix INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

function countLocal(): number {
  const row = localDb.prepare("SELECT COUNT(*) as c FROM block_timestamps").get() as any;
  return row.c;
}

/* -------------------------------------------------------------------------- */
/*  Config                                                                     */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Cola de trabajo                                                           */
/* -------------------------------------------------------------------------- */

let globalProgress = 0;
let globalTotal = 0;
let globalStart = 0;
let globalTimer: ReturnType<typeof setInterval> | null = null;
let globalRpcErrors: Map<string, number> | null = null;

function fmtTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

function startProgressReporter() {
  globalStart = Date.now();
  globalTimer = setInterval(() => {
    const elapsed = (Date.now() - globalStart) / 1000;
    const pct = ((globalProgress / globalTotal) * 100).toFixed(1);
    let eta = "";
    if (globalProgress > 0) {
      const remaining =
        (elapsed / globalProgress) * (globalTotal - globalProgress);
      eta = ` | ETA: ${fmtTime(remaining)}`;
    }
    let rpcErr = "";
    if (globalRpcErrors) {
      const bad = [...globalRpcErrors.values()].filter((c) => c > 0).length;
      if (bad > 0)
        rpcErr = ` | RPC con errores: ${bad}/${globalRpcErrors.size}`;
    }
    process.stdout.write(
      `\r  Progreso: ${globalProgress}/${globalTotal} (${pct}%) | ${fmtTime(elapsed)}${eta}${rpcErr}     `,
    );
  }, 1000);
}

function stopProgressReporter() {
  if (globalTimer) {
    clearInterval(globalTimer);
    globalTimer = null;
  }
  process.stdout.write("\r");
}

async function runSharedQueue(
  blocks: number[],
  failedBlocks: number[],
  rpcErrors: Map<string, number>,
): Promise<number> {
  let idx = 0;
  let updated = 0;

  async function worker(rpcUrl: string) {
    const client = createClient(rpcUrl);
    while (true) {
      const blockNum = takeNext();
      if (blockNum === null) break;
      try {
        const ts = await fetchBlockTimestamp(client, blockNum);
        updateBlockTimestamps(blockNum, ts);
        updated++;
      } catch (err) {
        failedBlocks.push(blockNum);
        rpcErrors.set(rpcUrl, (rpcErrors.get(rpcUrl) ?? 0) + 1);
        logRpcError(rpcUrl, `Block: ${blockNum}`, err, "first-pass", true);
      } finally {
        globalProgress++;
      }
    }
  }

  function takeNext(): number | null {
    if (idx >= blocks.length) return null;
    return blocks[idx++];
  }

  const workers: Promise<void>[] = [];
  for (const { url, concurrency } of RPC_CONFIG) {
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker(url));
    }
  }
  await Promise.all(workers);
  return updated;
}

async function fetchBlockTimestamp(
  client: any,
  blockNum: number,
): Promise<number> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const block = (await client.getBlock({
        blockNumber: BigInt(blockNum),
      })) as any;
      if (block) return Number(block.timestamp);
    } catch (err) {
      lastError = err;
      const msg =
        (err as any)?.message ?? (err as any)?.shortMessage ?? "unknown";
      if (
        msg.includes("rate limit") ||
        msg.includes("429") ||
        msg.includes("over rate limit")
      ) {
        const wait = 2000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError ?? new Error("no timestamp");
}

/* -------------------------------------------------------------------------- */
/*  Reproceso de errores (usa todos los RPCs rotando)                         */
/* -------------------------------------------------------------------------- */

const ALL_CLIENTS = RPC_URLS.map(createClient);

async function reprocessFailed(
  failedBlocks: number[],
): Promise<number> {
  if (failedBlocks.length === 0) return 0;

  console.log(
    `\nReprocesando ${failedBlocks.length} bloques fallidos con todos los RPCs...`,
  );

  let idx = 0;
  let recovered = 0;
  const stillFailing: number[] = [];

  async function reprocessWorker() {
    while (true) {
      const blockNum = takeNext();
      if (blockNum === null) break;

      let success = false;
      for (let attempt = 0; attempt < 5 && !success; attempt++) {
        for (let ci = 0; ci < ALL_CLIENTS.length && !success; ci++) {
          try {
            const ts = await fetchBlockTimestamp(ALL_CLIENTS[ci], blockNum);
            updateBlockTimestamps(blockNum, ts);
            recovered++;
            success = true;
          } catch (err) {
            logRpcError(RPC_URLS[ci], `Block: ${blockNum}`, err, "reprocess", true);
          }
        }
        if (!success) {
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        }
      }
      if (!success) {
        stillFailing.push(blockNum);
      }
      globalProgress++;
    }
  }

  function takeNext(): number | null {
    if (idx >= failedBlocks.length) return null;
    return failedBlocks[idx++];
  }

  const totalWorkers = RPC_CONFIG.reduce((s, c) => s + c.concurrency, 0);
  const reprocessWorkers = Math.min(totalWorkers, failedBlocks.length);
  await Promise.all(
    Array.from({ length: reprocessWorkers }, () => reprocessWorker()),
  );

  failedBlocks.length = 0;
  failedBlocks.push(...stillFailing);

  return recovered;
}

/* -------------------------------------------------------------------------- */
/*  Updates                                                                   */
/* -------------------------------------------------------------------------- */

const upsertStmt = localDb.prepare(`
  INSERT OR REPLACE INTO block_timestamps (block_number, block_timestamp, block_timestamp_unix)
  VALUES (?, ?, ?)
`);

function updateBlockTimestamps(blockNum: number, ts: number): void {
  const isoString = new Date(ts * 1000).toISOString();
  upsertStmt.run(blockNum, isoString, ts);
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                      */
/* -------------------------------------------------------------------------- */

async function main() {
  const db = initRemoteDB(accountId, databaseId, apiToken);

  console.log("Obteniendo bloques con block_timestamp_unix = 0...");
  const rows = await db
    .select({ blockNumber: schema.orderEvents.blockNumber })
    .from(schema.orderEvents)
    .where(eq(schema.orderEvents.blockTimestampUnix, 0))
    .groupBy(schema.orderEvents.blockNumber);

  if (rows.length === 0) {
    console.log("No se encontraron bloques pendientes.");
    return;
  }

  const totalBlocks = rows.length;
  const allBlocks = rows.map((r) => r.blockNumber);
  console.log(`Bloques únicos pendientes: ${totalBlocks}`);
  console.log(`RPCs disponibles: ${RPC_URLS.length}`);

  const failedBlocks: number[] = [];
  const rpcErrors = new Map<string, number>();
  globalRpcErrors = rpcErrors;
  let totalUpdated = 0;

  globalProgress = 0;
  globalTotal = totalBlocks;

  const startTime = Date.now();
  startProgressReporter();

  console.log(`Workers pool compartido:`);
  for (const { url, concurrency } of RPC_CONFIG) {
    const short = url.replace(/https?:\/\//, "").slice(0, 45);
    console.log(`  ${String(concurrency).padStart(2)} workers → ${short}`);
  }
  const totalWorkers = RPC_CONFIG.reduce((s, c) => s + c.concurrency, 0);
  console.log(`  Total: ${totalWorkers} requests simultáneas\n`);

  totalUpdated = await runSharedQueue(allBlocks, failedBlocks, rpcErrors);

  stopProgressReporter();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nPrimera pasada completada en ${elapsed}s`);
  console.log(`  Bloques procesados: ${totalUpdated}/${totalBlocks}`);
  console.log(`  Bloques fallidos: ${failedBlocks.length}`);

  if (failedBlocks.length > 0) {
    globalProgress = 0;
    globalTotal = failedBlocks.length;
    startProgressReporter();
  }
  const recovered = await reprocessFailed(failedBlocks);
  stopProgressReporter();
  totalUpdated += recovered;

  const finalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\nResumen final (${finalElapsed}s):`);
  console.log(`  Bloques totales: ${totalBlocks}`);
  console.log(`  Procesados exitosamente: ${totalUpdated}`);
  console.log(`  Fallidos definitivos: ${failedBlocks.length}`);
  if (failedBlocks.length > 0) {
    console.log(`  Bloques fallidos: ${failedBlocks.join(", ")}`);
  }

  if (rpcErrors.size > 0) {
    console.log(`\n  Errores por RPC:`);
    const sorted = [...rpcErrors.entries()].sort((a, b) => b[1] - a[1]);
    for (const [url, count] of sorted) {
      const short = url.replace(/https?:\/\//, "").slice(0, 50);
      console.log(`    ${count.toString().padStart(4)} ${short}`);
    }
  }

  console.log(`  Registros en SQLite local: ${countLocal()}`);
  console.log(`  DB local: ${LOCAL_DB_PATH}`);
  console.log(`  Para migrar a D1: pnpm tsx src/migrate-local-to-d1.ts`);
}

main().catch(console.error);
