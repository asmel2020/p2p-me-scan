import {
  decodeLog,
  ORDER_EVENT_ABI,
  DIAMOND_ADDRESS,
  type ChainEvent,
} from "../shared/events";
import { persistEvent } from "../shared/db/store";
import { setLastBlock } from "../shared/db/state";
import {
  RPC_CONFIG,
  RPC_URLS,
  createClient,
  logRpcError,
  Semaphore,
} from "../shared/rpc-config";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@p2p-me/db";

const CHUNK_SIZE = 800n;

const semaphores = RPC_CONFIG.map((c) => new Semaphore(c.maxInflight));
const clients = RPC_URLS.map(createClient);
const failedChunks: string[] = [];
const persistErrors: string[] = [];
const PERSIST_CONCURRENCY = 3;

async function fetchBlockTimestampSafe(
  blockNumber: bigint,
): Promise<number | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (let ci = 0; ci < clients.length; ci++) {
      try {
        await semaphores[ci].acquire();
        try {
          const block = (await clients[ci].getBlock({ blockNumber })) as any;
          return Number(block.timestamp);
        } finally {
          semaphores[ci].release();
        }
      } catch (err: any) {
        const isRateLimit =
          err.message?.includes("rate limit") ||
          err.message?.includes("429") ||
          err.message?.includes("over rate limit");
        if (isRateLimit) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
        if (attempt === 2 && ci === clients.length - 1) {
          logRpcError(RPC_URLS[ci], `Block: ${blockNumber}`, err);
        }
      }
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  return null;
}

async function persistEventsWithLimit(
  db: DrizzleD1Database<typeof schema>,
  events: ChainEvent[],
): Promise<void> {
  let idx = 0;
  function takeNextEvent() {
    if (idx >= events.length) return null;
    return events[idx++];
  }

  async function persistWorker() {
    while (true) {
      const event = takeNextEvent();
      if (!event) break;
      try {
        await persistEvent(db, event);
      } catch (err) {
        const msg = (err as any)?.message ?? (err as any)?.cause ?? String(err);
        persistErrors.push(`Order ${event.orderId} (block ${event.blockNumber}): ${msg}`);
        logRpcError("d1-persist", `Order ${event.orderId} block ${event.blockNumber}`, err);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(PERSIST_CONCURRENCY, events.length) }, () => persistWorker()),
  );
}

async function processChunk(
  fromBlock: bigint,
  toBlock: bigint,
  clientIndex: number,
): Promise<ChainEvent[]> {
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await semaphores[clientIndex].acquire();
      let logs;
      try {
        logs = await clients[clientIndex].getLogs({
          address: DIAMOND_ADDRESS as any,
          events: ORDER_EVENT_ABI,
          fromBlock,
          toBlock,
        });
      } finally {
        semaphores[clientIndex].release();
      }

      if (logs.length === 0) return [];

      const decoded: ChainEvent[] = [];
      for (const log of logs as any[]) {
        const e = decodeLog(log);
        if (e) decoded.push(e);
      }

      const uniqueBlocks = [...new Set(decoded.map((e) => e.blockNumber))].sort(
        (a, b) => a - b,
      );
      const blockTimestamps = new Map<string, number>();

      const tsResults = await Promise.allSettled(
        uniqueBlocks.map(async (bn) => ({
          bn,
          ts: await fetchBlockTimestampSafe(BigInt(bn)),
        })),
      );
      for (const r of tsResults) {
        if (r.status === "fulfilled" && r.value.ts !== null) {
          blockTimestamps.set(r.value.bn.toString(), r.value.ts);
        }
      }

      for (let i = 0; i < uniqueBlocks.length; i++) {
        const bn = uniqueBlocks[i];
        if (blockTimestamps.has(bn.toString())) continue;

        let estimatedTs = 0;
        for (let offset = 1; offset <= uniqueBlocks.length; offset++) {
          const nextBn = uniqueBlocks[i + offset];
          const prevBn = uniqueBlocks[i - offset];
          if (
            i + offset < uniqueBlocks.length &&
            blockTimestamps.has(nextBn.toString())
          ) {
            estimatedTs = blockTimestamps.get(nextBn.toString())! - offset * 2;
            break;
          }
          if (i - offset >= 0 && blockTimestamps.has(prevBn.toString())) {
            estimatedTs = blockTimestamps.get(prevBn.toString())! + offset * 2;
            break;
          }
        }

        if (estimatedTs > 0) {
          blockTimestamps.set(bn.toString(), estimatedTs);
          console.warn(
            `    Timestamp estimado para bloque ${bn}: ${estimatedTs}`,
          );
        } else {
          console.warn(
            `    Bloque ${bn} sin timestamp — omitiendo ${decoded.filter((e) => e.blockNumber === bn).length} eventos`,
          );
        }
      }

      const validDecoded = decoded.filter((e) =>
        blockTimestamps.has(e.blockNumber.toString()),
      );
      for (const e of validDecoded) {
        const ts = blockTimestamps.get(e.blockNumber.toString())!;
        e.blockTimestampUnix = ts;
        e.blockTimestamp = new Date(ts * 1000).toISOString();
      }

      return validDecoded;
    } catch (err: any) {
      const isRateLimit =
        err.message?.includes("rate limit") ||
        err.message?.includes("429") ||
        err.message?.includes("over rate limit");
      const isSizeLimit =
        err.message?.includes("Log response size exceeded") ||
        err.message?.includes("exceeds defined limit");

      if (isSizeLimit && fromBlock < toBlock) {
        const mid = (fromBlock + toBlock) / 2n;
        const otherIdx = (clientIndex + 1) % RPC_URLS.length;
        const [left, right] = await Promise.all([
          processChunk(fromBlock, mid, otherIdx),
          processChunk(mid + 1n, toBlock, otherIdx),
        ]);
        return [...left, ...right];
      }

      if (isRateLimit && attempt < MAX_RETRIES) {
        const wait = Math.pow(2, attempt) * 1000 + Math.random() * 2000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      if (fromBlock === toBlock) {
        const msg = err.message ?? "error";
        console.error(`  Bloque irrecuperable ${fromBlock}: ${msg}`);
        logRpcError(
          RPC_URLS[clientIndex],
          `Block irrecuperable: ${fromBlock}`,
          err,
        );
        failedChunks.push(`Bloque ${fromBlock}`);
        return [];
      }

      const mid = (fromBlock + toBlock) / 2n;
      const otherIdx = (clientIndex + 1) % RPC_URLS.length;
      const [left, right] = await Promise.all([
        processChunk(fromBlock, mid, otherIdx),
        processChunk(mid + 1n, toBlock, otherIdx),
      ]);
      return [...left, ...right];
    }
  }
  return [];
}

export async function fastCatchup(
  db: DrizzleD1Database<typeof schema>,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<void> {
  const totalBlocks = toBlock - fromBlock + 1n;
  console.log(
    `\n=== CATCHUP: ${fromBlock} → ${toBlock} (${totalBlocks} bloques) ===`,
  );

  const chunks: { from: bigint; to: bigint }[] = [];
  for (let b = fromBlock; b <= toBlock; b += CHUNK_SIZE) {
    const end = b + CHUNK_SIZE - 1n > toBlock ? toBlock : b + CHUNK_SIZE - 1n;
    chunks.push({ from: b, to: end });
  }

  const totalWorkers = RPC_CONFIG.reduce((s, c) => s + c.maxInflight, 0);
  console.log(
    `  ${chunks.length} chunks de ${CHUNK_SIZE} bloques (workers: ${totalWorkers})`,
  );
  console.log(`  Pool de workers:`);
  for (const { url, maxInflight } of RPC_CONFIG) {
    const short = url.replace(/https?:\/\//, "").slice(0, 45);
    console.log(`    ${String(maxInflight).padStart(2)} workers → ${short}`);
  }
  console.log("  Procesando...");

  let chunkIdx = 0;
  function takeNextChunk() {
    if (chunkIdx >= chunks.length) return null;
    return chunks[chunkIdx++];
  }

  let totalEvents = 0;
  const startTime = Date.now();

  const workerPromises: Promise<void>[] = [];
  for (let ci = 0; ci < RPC_CONFIG.length; ci++) {
    for (let w = 0; w < RPC_CONFIG[ci].maxInflight; w++) {
      workerPromises.push(
        (async () => {
          while (true) {
            const chunk = takeNextChunk();
            if (!chunk) break;
            const events = await processChunk(chunk.from, chunk.to, ci);
            if (events.length > 0) {
              await persistEventsWithLimit(db, events);
            }
            totalEvents += events.length;
          }
        })(),
      );
    }
  }
  await Promise.all(workerPromises);

  await setLastBlock(db, toBlock);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n=== CATCHUP COMPLETADO en ${totalTime}s — ${totalEvents} eventos ===`,
  );

  if (failedChunks.length > 0) {
    console.log(`\nBloques fallidos (${failedChunks.length}):`);
    for (const f of failedChunks) {
      console.log(`  - ${f}`);
    }
console.log(`  (detalles en rpc-errors.log)`);
    }
    if (persistErrors.length > 0) {
      console.log(`\nErrores de persistencia (${persistErrors.length}):`);
      for (const e of persistErrors.slice(0, 10)) {
        console.log(`  - ${e}`);
      }
      if (persistErrors.length > 10) {
        console.log(`  ... y ${persistErrors.length - 10} más`);
      }
      console.log(`  (detalles en rpc-errors.log)`);
  }
  console.log("");
}
