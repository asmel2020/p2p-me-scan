import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { decodeLog, ORDER_EVENT_ABI, DIAMOND_ADDRESS, type ChainEvent } from "./events";
import { persistEvent } from "./db/store";
import { setLastBlock } from "./db/state";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@p2p-me/db";

const RPC_URLS = ["https://mainnet.base.org", "https://8453.rpc.thirdweb.com"];
const CHUNK_SIZE = 800n;
const CONCURRENCY = 20;
const CHECKPOINT_INTERVAL = 5;

function createClient(url: string) {
  return createPublicClient({
    chain: base,
    transport: http(url, { timeout: 30000 }),
  });
}

const clients = RPC_URLS.map(createClient);

async function fetchBlockTimestampSafe(blockNumber: bigint): Promise<number | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (let ci = 0; ci < clients.length; ci++) {
      try {
        const block = await clients[ci].getBlock({ blockNumber }) as any;
        return Number(block.timestamp);
      } catch (err: any) {
        const isRateLimit =
          err.message?.includes("rate limit") ||
          err.message?.includes("429") ||
          err.message?.includes("over rate limit");
        if (isRateLimit) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }
    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
  }
  return null;
}

async function processChunk(
  fromBlock: bigint,
  toBlock: bigint,
  clientIndex: number,
): Promise<ChainEvent[]> {
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const logs = await clients[clientIndex].getLogs({
        address: DIAMOND_ADDRESS as any,
        events: ORDER_EVENT_ABI,
        fromBlock,
        toBlock,
      });

      if (logs.length === 0) return [];

      const decoded: ChainEvent[] = [];
      for (const log of logs as any[]) {
        const e = decodeLog(log);
        if (e) decoded.push(e);
      }

      const uniqueBlocks = [...new Set(decoded.map((e) => e.blockNumber))].sort((a, b) => a - b);
      const blockTimestamps = new Map<string, number>();

      const tsResults = await Promise.allSettled(
        uniqueBlocks.map(async (bn) => ({ bn, ts: await fetchBlockTimestampSafe(BigInt(bn)) })),
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
          if (i + offset < uniqueBlocks.length && blockTimestamps.has(nextBn.toString())) {
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
          console.warn(`    Timestamp estimado para bloque ${bn}: ${estimatedTs}`);
        } else {
          console.warn(`    Bloque ${bn} sin timestamp — omitiendo ${decoded.filter(e => e.blockNumber === bn).length} eventos`);
        }
      }

      const validDecoded = decoded.filter((e) => blockTimestamps.has(e.blockNumber.toString()));
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
        console.error(`  Bloque irrecuperable ${fromBlock}: ${err.message ?? "error"}`);
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
  console.log(`\n=== CATCHUP: ${fromBlock} → ${toBlock} (${totalBlocks} bloques) ===`);

  const chunks: { from: bigint; to: bigint }[] = [];
  for (let b = fromBlock; b <= toBlock; b += CHUNK_SIZE) {
    const end = b + CHUNK_SIZE - 1n > toBlock ? toBlock : b + CHUNK_SIZE - 1n;
    chunks.push({ from: b, to: end });
  }

  console.log(`  ${chunks.length} chunks de ${CHUNK_SIZE} bloques (concurrencia: ${CONCURRENCY})`);
  console.log("  Procesando...");

  const startTime = Date.now();
  let totalEvents = 0;
  let processedChunks = 0;

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunk, idx) =>
        new Promise((resolve) => setTimeout(resolve, idx * 100)).then(() =>
          processChunk(chunk.from, chunk.to, idx % RPC_URLS.length),
        ),
      ),
    );

    for (const events of results) {
      if (events.length > 0) {
        await Promise.all(events.map((e) => persistEvent(db, e)));
        totalEvents += events.length;
      }
    }

    processedChunks += batch.length;
    const elapsed = (Date.now() - startTime) / 1000;
    const pct = ((processedChunks / chunks.length) * 100).toFixed(1);
    const avgPerChunk = elapsed / processedChunks;
    const remaining = Math.round(avgPerChunk * (chunks.length - processedChunks));
    const eta = remaining >= 60
      ? `${Math.floor(remaining / 60)}m ${remaining % 60}s`
      : `${remaining}s`;

    console.log(
      `  Progreso: ${processedChunks}/${chunks.length} chunks (${pct}%) | Eventos: ${totalEvents} | ${elapsed}s | ETA: ${eta}`,
    );

    if (processedChunks % CHECKPOINT_INTERVAL === 0) {
      const lastProcessedBlock = batch[batch.length - 1].to;
      await setLastBlock(db, lastProcessedBlock);
    }
  }

  await setLastBlock(db, toBlock);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`=== CATCHUP COMPLETADO en ${totalTime}s — ${totalEvents} eventos ===\n`);
}
