import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { eq, count } from "drizzle-orm";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { initRemoteDB } from "@p2p-me/db/client";
import * as schema from "@p2p-me/db";

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

const RPC_URLS = [
  "https://mainnet.base.org",
  "https://8453.rpc.thirdweb.com",
  "https://rpc.nodeflare.app/base/public",
  "https://developer-access-mainnet.base.org",
  "https://base.public.blockpi.network/v1/rpc/public",
  "https://base-public.nodies.app",
  "https://base.meowrpc.com",
  "https://base-mainnet.public.blastapi.io",
  "https://base.gateway.tenderly.co",
  "https://gateway.tenderly.co/public/base",
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
  "https://base-mainnet.gateway.tatum.io",
  "https://api.zan.top/base-mainnet",
  "https://base.lava.build",
  "https://rpc.owlracle.info/base/70d38ce1826c4a60bb2a8e05a6c8b20f",
  "https://base.api.pocket.network",
  "https://base.rpc.blxrbdn.com",
  "https://api-base-mainnet-archive.n.dwellir.com/2ccf18bf-2916-4198-8856-42172854353c",
  "https://base.rpc.sentio.xyz",
  "https://rpc.baseazul.dev",
];

function createClient(url: string) {
  return createPublicClient({
    chain: base,
    transport: http(url, { timeout: 30000 }),
  });
}

/* -------------------------------------------------------------------------- */
/*  Config                                                                     */
/* -------------------------------------------------------------------------- */

const PER_RPC_CONCURRENCY = 5; // peticiones paralelas por RPC

/* -------------------------------------------------------------------------- */
/*  Cola de trabajo                                                           */
/* -------------------------------------------------------------------------- */

interface QueueResult {
  updated: number;
}

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

async function runQueue(
  blocks: number[],
  rpcUrl: string,
  db: ReturnType<typeof initRemoteDB>,
  failedBlocks: number[],
  rpcErrors: Map<string, number>,
): Promise<QueueResult> {
  const client = createClient(rpcUrl);
  let updated = 0;

  for (let i = 0; i < blocks.length; i += PER_RPC_CONCURRENCY) {
    const batch = blocks.slice(i, i + PER_RPC_CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (blockNum) => {
        try {
          const ts = await fetchBlockTimestamp(client, blockNum);
          if (ts === null) throw new Error("no timestamp");
          await updateBlockTimestamps(db, blockNum, ts);
          updated++;
        } catch {
          failedBlocks.push(blockNum);
          rpcErrors.set(rpcUrl, (rpcErrors.get(rpcUrl) ?? 0) + 1);
        } finally {
          globalProgress++;
        }
      }),
    );
  }

  return { updated };
}

async function fetchBlockTimestamp(
  client: any,
  blockNum: number,
): Promise<number | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const block = (await client.getBlock({
        blockNumber: BigInt(blockNum),
      })) as any;
      if (block) return Number(block.timestamp);
    } catch (err: any) {
      const msg = err?.message ?? err?.shortMessage ?? "unknown";
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
  return null;
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

  let recovered = 0;
  const stillFailing: number[] = [];

  for (const blockNum of failedBlocks) {
    let success = false;
    for (let attempt = 0; attempt < 5 && !success; attempt++) {
      for (let ci = 0; ci < ALL_CLIENTS.length && !success; ci++) {
        try {
          const ts = await fetchBlockTimestamp(ALL_CLIENTS[ci], blockNum);
          if (ts !== null) {
            await updateBlockTimestamps(db, blockNum, ts);
            recovered++;
            success = true;
          }
        } catch {
          // next client
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
  console.log(
    `Bloques por cola: ~${Math.ceil(totalBlocks / RPC_URLS.length)}\n`,
  );

  const queues: number[][] = Array.from({ length: RPC_URLS.length }, () => []);
  for (let i = 0; i < allBlocks.length; i++) {
    queues[i % RPC_URLS.length].push(allBlocks[i]);
  }

  const failedBlocks: number[] = [];
  const rpcErrors = new Map<string, number>();
  globalRpcErrors = rpcErrors;
  let totalUpdated = 0;

  globalProgress = 0;
  globalTotal = totalBlocks;

  const startTime = Date.now();
  startProgressReporter();

  console.log(
    `Colas: ${RPC_URLS.length} | Concurrencia por RPC: ${PER_RPC_CONCURRENCY}`,
  );
  console.log(
    `Total paralelismo: ${RPC_URLS.length * PER_RPC_CONCURRENCY} requests simultáneas\n`,
  );

  const results = await Promise.allSettled(
    queues.map((queue, i) => {
      if (queue.length === 0) return Promise.resolve({ updated: 0 });
      return runQueue(queue, RPC_URLS[i], db, failedBlocks, rpcErrors);
    }),
  );

  stopProgressReporter();

  for (const r of results) {
    if (r.status === "fulfilled") {
      totalUpdated += r.value.updated;
    }
  }

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
    console.log(`\n  Errores por RPC (concurrencia ${PER_RPC_CONCURRENCY}):`);
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
