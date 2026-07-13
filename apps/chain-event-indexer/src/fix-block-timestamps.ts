import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { eq, count } from "drizzle-orm";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { initRemoteDB } from "@p2p-me/db/client";
import * as schema from "@p2p-me/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.resolve(__dirname, "rpc-errors.log");

const envPath = path.resolve(process.cwd(), "../../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_API_TOKEN } =
  process.env;

if (
  !CLOUDFLARE_ACCOUNT_ID ||
  !CLOUDFLARE_DATABASE_ID ||
  !CLOUDFLARE_API_TOKEN
) {
  console.error(
    "Faltan variables de entorno: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_API_TOKEN",
  );
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/*  RPCs                                                                      */
/* -------------------------------------------------------------------------- */

const RPC_CONFIG = [
  {
    url: "https://rpc.ankr.com/base/e487627c09ac093cbf96da8b4661adbda413391c1824c0c09a8bb1ad314bdd06",
    concurrency: 25,
  },
  {
    url: "https://rpc.ankr.com/base/285e771bfe6acaa6bb6e61aff95927f087f0a7b06d4b5c8be826e44914d49ec4",
    concurrency: 25,
  },
  {
    url: "https://rpc.ankr.com/base/277bb99f6262d8fc43f35b8c9e78858bcbbea4184dbf49cdc1a960429a76128d",
    concurrency: 25,
  },
  /*  {
    url: "https://rpc.ankr.com/base/9676e91ab178d118be498a3fa0f25ea5499e26bbfa8126ec2b1119d0238b4e02",
    concurrency: 25,
  }, */
  { url: "https://mainnet.base.org", concurrency: 8 },
];
const RPC_URLS = RPC_CONFIG.map((c) => c.url);

function createClient(url: string) {
  return createPublicClient({
    chain: base,
    transport: http(url, { timeout: 30000 }),
  });
}

function logRpcError(
  rpcUrl: string,
  blockNum: number,
  err: unknown,
  phase: string,
) {
  const msg =
    (err as any)?.message ??
    (err as any)?.shortMessage ??
    (err as any)?.cause ??
    String(err);
  const line = `[${new Date().toISOString()}] [${phase}] RPC: ${rpcUrl} | Block: ${blockNum} | Error: ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
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
  db: ReturnType<typeof initRemoteDB>,
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
        await updateBlockTimestamps(db, blockNum, ts);
        updated++;
      } catch (err) {
        failedBlocks.push(blockNum);
        rpcErrors.set(rpcUrl, (rpcErrors.get(rpcUrl) ?? 0) + 1);
        logRpcError(rpcUrl, blockNum, err, "first-pass");
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
  db: ReturnType<typeof initRemoteDB>,
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
            await updateBlockTimestamps(db, blockNum, ts);
            recovered++;
            success = true;
          } catch (err) {
            logRpcError(RPC_URLS[ci], blockNum, err, "reprocess");
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

async function updateBlockTimestamps(
  db: ReturnType<typeof initRemoteDB>,
  blockNum: number,
  ts: number,
): Promise<void> {
  const isoString = new Date(ts * 1000).toISOString();

  await db
    .update(schema.orderEvents)
    .set({ blockTimestamp: isoString, blockTimestampUnix: ts })
    .where(eq(schema.orderEvents.blockNumber, blockNum));

  await db
    .update(schema.orders)
    .set({ blockTimestamp: isoString, blockTimestampUnix: ts })
    .where(eq(schema.orders.updatedBlock, blockNum));
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                      */
/* -------------------------------------------------------------------------- */

async function main() {
  const db = initRemoteDB(
    CLOUDFLARE_ACCOUNT_ID!,
    CLOUDFLARE_DATABASE_ID!,
    CLOUDFLARE_API_TOKEN!,
  );

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

  totalUpdated = await runSharedQueue(allBlocks, db, failedBlocks, rpcErrors);

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
  const recovered = await reprocessFailed(failedBlocks, db);
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

  const pending = await db
    .select({ total: count() })
    .from(schema.orderEvents)
    .where(eq(schema.orderEvents.blockTimestampUnix, 0));
  console.log(`  Pendientes en order_events: ${pending[0]?.total ?? "?"}`);
}

main().catch(console.error);
