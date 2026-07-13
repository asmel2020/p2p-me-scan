import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { decodeLog, ORDER_EVENT_ABI, DIAMOND_ADDRESS } from "../shared/events";
import {
  RPC_CONFIG,
  RPC_URLS,
  createClient,
  logRpcError,
  Semaphore,
} from "../shared/rpc-config";
import "../shared/env";
import { DATA_DIR } from "../shared/rpc-config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.resolve(DATA_DIR, "scanned-events.db");

const START_BLOCK = 43103682n;
const CHUNK_SIZE = 100n;

/* -------------------------------------------------------------------------- */
/*  Local SQLite                                                               */
/* -------------------------------------------------------------------------- */

const localDb = new Database(LOCAL_DB_PATH);
localDb.pragma("journal_mode = WAL");
localDb.exec(`
  CREATE TABLE IF NOT EXISTS scanned_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    event_name TEXT NOT NULL,
    user_addr TEXT NOT NULL DEFAULT '-',
    merchant_addr TEXT NOT NULL DEFAULT '-',
    recipient_addr TEXT NOT NULL DEFAULT '-',
    accepted_merchant TEXT NOT NULL DEFAULT '-',
    usdc REAL NOT NULL DEFAULT 0,
    fiat REAL NOT NULL DEFAULT 0,
    order_type TEXT NOT NULL DEFAULT '-',
    currency TEXT NOT NULL DEFAULT '-',
    block_number INTEGER NOT NULL,
    block_timestamp TEXT NOT NULL DEFAULT '',
    block_timestamp_unix INTEGER NOT NULL DEFAULT 0,
    tx_hash TEXT NOT NULL DEFAULT '',
    log_index INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

localDb.exec(`
  CREATE TABLE IF NOT EXISTS scanned_blocks (
    block_number INTEGER PRIMARY KEY,
    processed INTEGER NOT NULL DEFAULT 0,
    events_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

const insertEvent = localDb.prepare(`
  INSERT OR IGNORE INTO scanned_events (
    order_id, event_name, user_addr, merchant_addr, recipient_addr,
    accepted_merchant, usdc, fiat, order_type, currency,
    block_number, block_timestamp, block_timestamp_unix, tx_hash, log_index
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const upsertBlockOk = localDb.prepare(`
  INSERT INTO scanned_blocks (block_number, processed, events_count)
  VALUES (?, 1, ?)
  ON CONFLICT(block_number) DO UPDATE SET processed=1, events_count=excluded.events_count, error=NULL
`);

const markRangeProcessed = localDb.prepare(`
  UPDATE scanned_blocks SET processed = 1 WHERE block_number BETWEEN ? AND ?
`);

function countLocalScanned(): number {
  const row = localDb
    .prepare("SELECT COUNT(*) as c FROM scanned_events")
    .get() as any;
  return row.c;
}

/* -------------------------------------------------------------------------- */
/*  Progreso                                                                  */
/* -------------------------------------------------------------------------- */

let globalProgress = 0;
let globalTotal = 0;
let globalTotalEvents = 0;
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
      `\r  Bloques: ${globalProgress}/${globalTotal} (${pct}%) | Eventos: ${globalTotalEvents} | ${fmtTime(elapsed)}${eta}${rpcErr}     `,
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

/* -------------------------------------------------------------------------- */
/*  Semáforos por RPC                                                         */
/* -------------------------------------------------------------------------- */

const semaphores = new Map<string, Semaphore>();
for (const { url, maxInflight } of RPC_CONFIG) {
  semaphores.set(url, new Semaphore(maxInflight));
}

/* -------------------------------------------------------------------------- */
/*  Procesamiento de chunks                                                   */
/* -------------------------------------------------------------------------- */

const failedBlocks: bigint[] = [];

async function fetchBlockTimestamp(
  client: any,
  blockNum: bigint,
): Promise<number> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const block = (await client.getBlock({ blockNumber: blockNum })) as any;
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

async function processChunk(
  fromBlock: bigint,
  toBlock: bigint,
  client: any,
  rpcUrl: string,
): Promise<number> {
  const sem = semaphores.get(rpcUrl)!;
  const MAX_RETRIES = 3;
  const rangeLen = Number(toBlock - fromBlock + 1n);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sem.acquire();
      let logs: any[];
      try {
        logs = (await client.getLogs({
          address: DIAMOND_ADDRESS as any,
          events: ORDER_EVENT_ABI,
          fromBlock,
          toBlock,
        })) as any[];
      } finally {
        sem.release();
      }

      if (logs.length === 0) {
        markRangeProcessed.run(Number(fromBlock), Number(toBlock));
        globalProgress += rangeLen;
        return 0;
      }

      const decodedEvents: any[] = [];
      let minBlock: bigint | null = null;
      for (const log of logs) {
        const decoded = decodeLog(log);
        if (!decoded) continue;
        const bn = BigInt(decoded.blockNumber);
        if (minBlock === null || bn < minBlock) minBlock = bn;
        decodedEvents.push(decoded);
      }

      if (decodedEvents.length === 0) {
        markRangeProcessed.run(Number(fromBlock), Number(toBlock));
        globalProgress += rangeLen;
        return 0;
      }

      const uniqueBlocks = [
        ...new Set(decodedEvents.map((e) => BigInt(e.blockNumber))),
      ];

      const blockTimestamps = new Map<string, number>();
      for (const bn of uniqueBlocks) {
        await sem.acquire();
        try {
          const ts = await fetchBlockTimestamp(client, bn);
          blockTimestamps.set(bn.toString(), ts);
        } finally {
          sem.release();
        }
      }

      const insertMany = localDb.transaction(
        (
          events: Array<{
            orderId: number;
            eventName: string;
            user: string;
            merchant: string;
            recipientAddr: string;
            acceptedMerchant: string;
            usdc: number;
            fiat: number;
            orderType: string;
            currency: string;
            blockNumber: number;
            blockTimestamp: string;
            blockTimestampUnix: number;
            txHash: string;
            logIndex: number | null;
          }>,
        ) => {
          for (const e of events) {
            insertEvent.run(
              e.orderId,
              e.eventName,
              e.user,
              e.merchant,
              e.recipientAddr,
              e.acceptedMerchant,
              e.usdc,
              e.fiat,
              e.orderType,
              e.currency,
              e.blockNumber,
              e.blockTimestamp,
              e.blockTimestampUnix,
              e.txHash,
              e.logIndex,
            );
          }
        },
      );

      for (const e of decodedEvents) {
        const ts = blockTimestamps.get(e.blockNumber.toString()) ?? 0;
        e.blockTimestampUnix = ts;
        e.blockTimestamp = new Date(ts * 1000).toISOString();
      }

      insertMany(decodedEvents);
      markRangeProcessed.run(Number(fromBlock), Number(toBlock));
      for (const e of decodedEvents) {
        upsertBlockOk.run(e.blockNumber, 1);
      }
      globalProgress += rangeLen;
      return decodedEvents.length;
    } catch (err: any) {
      const isRateLimit =
        err.message?.includes("rate limit") ||
        err.message?.includes("429") ||
        err.message?.includes("over rate limit");
      const isSizeLimit =
        err.message?.includes("Log response size exceeded") ||
        err.message?.includes("exceeds defined limit");

      if (isRateLimit && attempt < MAX_RETRIES) {
        const wait = Math.pow(3, attempt) * 3000 + Math.random() * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      if (isSizeLimit && fromBlock < toBlock) {
        const mid = (fromBlock + toBlock) / 2n;
        const [left, right] = await Promise.all([
          processChunk(fromBlock, mid, client, rpcUrl),
          processChunk(mid + 1n, toBlock, client, rpcUrl),
        ]);
        return left + right;
      }

      if (fromBlock === toBlock) {
        const errMsg = err.message ?? "unknown error";
        failedBlocks.push(fromBlock);
        logRpcError(rpcUrl, `Block: ${fromBlock}`, err, "scan-blocks", true);
        const msg =
          (err as any)?.message ?? (err as any)?.shortMessage ?? String(err);
        localDb
          .prepare(
            "UPDATE scanned_blocks SET processed=0, error=? WHERE block_number=?",
          )
          .run(msg.slice(0, 500), Number(fromBlock));
        globalProgress += 1;
        return 0;
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }

      const mid = (fromBlock + toBlock) / 2n;
      const [left, right] = await Promise.all([
        processChunk(fromBlock, mid, client, rpcUrl),
        processChunk(mid + 1n, toBlock, client, rpcUrl),
      ]);
      return left + right;
    }
  }
  return 0;
}

/* -------------------------------------------------------------------------- */
/*  Workers compartidos                                                       */
/* -------------------------------------------------------------------------- */

async function runSharedQueue(
  fromBlock: bigint,
  toBlock: bigint,
  scannedSet: Set<number>,
  rpcErrors: Map<string, number>,
): Promise<number> {
  let nextBlock = fromBlock;
  let totalEvents = 0;

  function isRangeProcessed(start: number, end: number): boolean {
    for (let b = start; b <= end; b++) {
      if (!scannedSet.has(b)) return false;
    }
    return true;
  }

  function takeNext(): { from: bigint; to: bigint } | null {
    while (nextBlock <= toBlock) {
      const chunkStart = nextBlock;
      const chunkEnd =
        nextBlock + CHUNK_SIZE - 1n > toBlock
          ? toBlock
          : nextBlock + CHUNK_SIZE - 1n;
      nextBlock = chunkEnd + 1n;

      if (!isRangeProcessed(Number(chunkStart), Number(chunkEnd))) {
        return { from: chunkStart, to: chunkEnd };
      }
    }
    return null;
  }

  async function worker(rpcUrl: string) {
    const client = createClient(rpcUrl);
    while (true) {
      const chunk = takeNext();
      if (!chunk) break;
      try {
        const count = await processChunk(chunk.from, chunk.to, client, rpcUrl);
        totalEvents += count;
      } catch (err) {
        failedBlocks.push(chunk.from);
        rpcErrors.set(rpcUrl, (rpcErrors.get(rpcUrl) ?? 0) + 1);
        logRpcError(rpcUrl, `Block: ${chunk.from}`, err, "scan-blocks", true);
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (const { url, concurrency } of RPC_CONFIG) {
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker(url));
    }
  }

  await Promise.all(workers);
  return totalEvents;
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                      */
/* -------------------------------------------------------------------------- */

async function main() {
  console.log("Inicializando...");

  let currentBlock: bigint;
  {
    const client = createClient(RPC_URLS[0]);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        currentBlock = await client.getBlockNumber();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
    currentBlock = await client.getBlockNumber();
  }

  /* Pre-registrar bloques faltantes */
  const maxRow = localDb
    .prepare("SELECT COALESCE(MAX(block_number), 0) as m FROM scanned_blocks")
    .get() as { m: number };

  const registerFrom = Math.max(Number(START_BLOCK), maxRow.m + 1);
  const currentBlockNum = Number(currentBlock);
  const newBlocksCount = Math.max(0, currentBlockNum - registerFrom + 1);

  if (newBlocksCount > 0) {
    console.log(
      `Pre-registrando ${newBlocksCount} bloques (${registerFrom} → ${currentBlockNum})...`,
    );
    const insertBlock = localDb.prepare(
      "INSERT OR IGNORE INTO scanned_blocks (block_number, processed) VALUES (?, 0)",
    );
    const insertBatch = localDb.transaction((blocks: number[]) => {
      for (const b of blocks) insertBlock.run(b);
    });

    for (let b = registerFrom; b <= currentBlockNum; b += 10000) {
      const end = Math.min(b + 9999, currentBlockNum);
      const batch: number[] = [];
      for (let i = b; i <= end; i++) batch.push(i);
      insertBatch(batch);
    }
    console.log(`  Pre-registro completado.`);
  }

  /* Cargar bloques ya procesados */
  const scannedSet = new Set(
    (
      localDb
        .prepare("SELECT block_number FROM scanned_blocks WHERE processed = 1")
        .all() as { block_number: number }[]
    ).map((r) => r.block_number),
  );

  /* Encontrar el primer bloque no procesado */
  const firstUnprocessed = localDb
    .prepare(
      "SELECT MIN(block_number) as m FROM scanned_blocks WHERE processed = 0",
    )
    .get() as { m: number | null };

  const resumeFrom = firstUnprocessed?.m ? BigInt(firstUnprocessed.m) : null;

  if (!resumeFrom || resumeFrom > currentBlock) {
    console.log(`Todos los bloques ya fueron escaneados correctamente.`);
    return;
  }

  const totalPendientes = Number(currentBlock - resumeFrom + 1n);
  console.log(
    `Reanudando desde bloque ${resumeFrom} → ${currentBlock} (${totalPendientes} bloques pendientes)`,
  );

  /* Mostrar fallidos */
  const failedList = localDb
    .prepare(
      "SELECT block_number, error FROM scanned_blocks WHERE processed = 0 AND error IS NOT NULL ORDER BY block_number",
    )
    .all() as { block_number: number; error: string | null }[];

  if (failedList.length > 0) {
    console.log(`  (${failedList.length} fallidos de ejecuciones anteriores)`);
    for (const f of failedList.slice(0, 5)) {
      console.log(
        `    ${f.block_number}: ${(f.error ?? "unknown").slice(0, 80)}`,
      );
    }
    if (failedList.length > 5)
      console.log(`    ... y ${failedList.length - 5} más`);
  }

  console.log(
    `Workers pool compartido (chunks de ${Number(CHUNK_SIZE)} bloques):`,
  );
  for (const { url, concurrency, maxInflight } of RPC_CONFIG) {
    const short = url.replace(/https?:\/\//, "").slice(0, 40);
    console.log(
      `  ${String(concurrency).padStart(2)} workers × ${maxInflight} max → ${short}`,
    );
  }
  const totalWorkers = RPC_CONFIG.reduce((s, c) => s + c.concurrency, 0);
  console.log(
    `  Total: ${totalWorkers} workers | Chunks pendientes: ~${Math.ceil(totalPendientes / Number(CHUNK_SIZE))}`,
  );
  console.log(`Guardando eventos en SQLite local: ${LOCAL_DB_PATH}\n`);

  const rpcErrors = new Map<string, number>();
  globalRpcErrors = rpcErrors;
  globalProgress = 0;
  globalTotal = totalPendientes;
  globalTotalEvents = 0;

  const startTime = Date.now();
  startProgressReporter();

  const totalEvents = await runSharedQueue(
    resumeFrom,
    currentBlock,
    scannedSet,
    rpcErrors,
  );

  stopProgressReporter();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\nEscaneo completado en ${totalTime}s`);
  console.log(`Total eventos encontrados: ${totalEvents}`);
  console.log(`Registros en SQLite local: ${countLocalScanned()}`);

  if (failedBlocks.length > 0) {
    const failedFile = path.resolve(DATA_DIR, "failed-blocks-scan.json");
    fs.writeFileSync(
      failedFile,
      JSON.stringify(
        {
          failedBlocks: failedBlocks.map((b) => b.toString()),
          total: failedBlocks.length,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.error(
      `\nBloques irrecuperables (${failedBlocks.length}) guardados en ${failedFile}`,
    );
  }

  if (rpcErrors.size > 0) {
    console.log(`\nErrores por RPC:`);
    const sorted = [...rpcErrors.entries()].sort((a, b) => b[1] - a[1]);
    for (const [url, count] of sorted) {
      const short = url.replace(/https?:\/\//, "").slice(0, 50);
      console.log(`  ${count.toString().padStart(4)} ${short}`);
    }
  }

  console.log(`\nDB local: ${LOCAL_DB_PATH}`);
  console.log(`Para migrar a D1: pnpm tsx src/migrate-scanned-events-to-d1.ts`);
}

main().catch(console.error);
