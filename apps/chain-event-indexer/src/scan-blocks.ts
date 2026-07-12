import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { decodeLog, ORDER_EVENT_ABI } from "./events";
import { initRemoteDB } from "@p2p-me/db/client";
import { persistEvent } from "./db/store";
import { setLastBlock } from "./db/state";

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

const RPC_URLS = ["https://mainnet.base.org", "https://8453.rpc.thirdweb.com"];

const START_BLOCK = 43103682n;
const CHUNK_SIZE = 800n;
const CONCURRENCY = 20;

function createClient(url: string) {
  return createPublicClient({
    chain: base,
    transport: http(url, { timeout: 30000 }),
  });
}

const clients = RPC_URLS.map(createClient);

async function processChunk(
  fromBlock: bigint,
  toBlock: bigint,
  clientIndex: number,
  db: any,
  retries = 3,
): Promise<{ count: number; firstBlock: bigint | null }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const logs = await clients[clientIndex].getLogs({
        address: "0x4cad6eC90e65baBec9335cAd728DDC610c316368" as any,
        events: ORDER_EVENT_ABI,
        fromBlock,
        toBlock,
      });

      if (logs.length === 0) return { count: 0, firstBlock: null };

      const decodedEvents: any[] = [];
      let minBlock: bigint | null = null;
      for (const log of logs as any[]) {
        const decoded = decodeLog(log);
        if (!decoded) continue;
        const bn = BigInt(decoded.blockNumber);
        if (minBlock === null || bn < minBlock) minBlock = bn;
        decodedEvents.push(decoded);
      }

      const uniqueBlocks = [...new Set(decodedEvents.map((e) => BigInt(e.blockNumber)))];
      const blockTimestamps = new Map<string, number>();
      const blocks = await Promise.all(
        uniqueBlocks.map((bn) => clients[clientIndex].getBlock({ blockNumber: bn })),
      );
      for (const block of blocks) {
        blockTimestamps.set(block.number.toString(), Number(block.timestamp));
      }
      for (const e of decodedEvents) {
        const ts = blockTimestamps.get(e.blockNumber.toString()) ?? 0;
        e.blockTimestampUnix = ts;
        e.blockTimestamp = new Date(ts * 1000).toISOString();
      }

      await Promise.all(decodedEvents.map((e) => persistEvent(db, e)));
      return { count: decodedEvents.length, firstBlock: minBlock };
    } catch (err: any) {
      const isRateLimit =
        err.message?.includes("rate limit") ||
        err.message?.includes("429") ||
        err.message?.includes("over rate limit");
      const isSizeLimit =
        err.message?.includes("Log response size exceeded") ||
        err.message?.includes("exceeds defined limit");
      if (isSizeLimit) {
        const mid = (fromBlock + toBlock) / 2n;
        const left = await processChunk(fromBlock, mid, clientIndex, db);
        const right = await processChunk(mid + 1n, toBlock, clientIndex, db);
        const firstBlock = left.firstBlock ?? right.firstBlock;
        return { count: left.count + right.count, firstBlock };
      }
      if (isRateLimit && attempt < 2) {
        const wait = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return { count: 0, firstBlock: null };
    }
  }
  return { count: 0, firstBlock: null };
}

async function main() {
  const db = initRemoteDB(
    CLOUDFLARE_ACCOUNT_ID!,
    CLOUDFLARE_DATABASE_ID!,
    CLOUDFLARE_API_TOKEN!,
  );

  const currentBlock = await clients[0].getBlockNumber();
  console.log(
    `Escaneando bloques ${START_BLOCK} → ${currentBlock} (${currentBlock - START_BLOCK} bloques)`,
  );

  let totalEvents = 0;
  let processedChunks = 0;
  let firstEventBlock: bigint | null = null;
  const startTime = Date.now();

  const chunks: { from: bigint; to: bigint }[] = [];
  for (let b = START_BLOCK; b <= currentBlock; b += CHUNK_SIZE) {
    const to =
      b + CHUNK_SIZE - 1n > currentBlock ? currentBlock : b + CHUNK_SIZE - 1n;
    chunks.push({ from: b, to });
  }

  console.log(
    `Total chunks: ${chunks.length} (${CHUNK_SIZE} bloques por chunk)`,
  );
  console.log(`Comenzando escaneo y guardado en D1...`);

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunk, idx) =>
        processChunk(chunk.from, chunk.to, idx % RPC_URLS.length, db),
      ),
    );
    const batchEvents = results.reduce((a, b) => a + b.count, 0);
    totalEvents += batchEvents;
    for (const r of results) {
      if (
        r.firstBlock !== null &&
        (firstEventBlock === null || r.firstBlock < firstEventBlock)
      ) {
        firstEventBlock = r.firstBlock;
      }
    }
    processedChunks += batch.length;



    const elapsed = (Date.now() - startTime) / 1000;
    const pct = ((processedChunks / chunks.length) * 100).toFixed(1);
    const avgPerChunk = elapsed / processedChunks;
    const remaining = Math.round(
      avgPerChunk * (chunks.length - processedChunks),
    );
    const eta =
      remaining >= 60
        ? `${Math.floor(remaining / 60)}m ${remaining % 60}s`
        : `${remaining}s`;
    console.log(
      `Progreso: ${processedChunks}/${chunks.length} chunks (${pct}%) | Eventos: ${totalEvents} | Transcurrido: ${elapsed}s | ETA: ${eta}`,
    );
  }

  const lastBlock = chunks[chunks.length - 1].to;
  await setLastBlock(db, lastBlock);
  console.log(`Ultimo bloque guardado en processorState: ${lastBlock}`);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\nEscaneo completado en ${totalTime}s`);
  console.log(`Total eventos encontrados: ${totalEvents}`);
  if (firstEventBlock !== null) {
    console.log(
      `Primer bloque con evento: ${firstEventBlock} (útil como nuevo START_BLOCK para re-ejecutar)`,
    );
  } else {
    console.log(`No se encontraron eventos en el rango`);
  }
}

main().catch(console.error);
