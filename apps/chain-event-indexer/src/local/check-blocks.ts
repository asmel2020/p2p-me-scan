import { decodeLog, ORDER_EVENT_ABI, DIAMOND_ADDRESS, type ChainEvent } from "../shared/events";
import { RPC_URLS, createClient } from "../shared/rpc-config";

const clients = RPC_URLS.map(createClient);

async function fetchChunk(
  fromBlock: bigint,
  toBlock: bigint,
  clientIndex: number,
  retries = 3,
): Promise<ChainEvent[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
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

      const uniqueBlocks = [...new Set(decoded.map((e) => e.blockNumber))];
      const timestamps = new Map<number, number>();
      const blocks = await Promise.all(
        uniqueBlocks.map((bn) =>
          clients[clientIndex].getBlock({ blockNumber: BigInt(bn) }).catch(() => null),
        ),
      );
      for (const block of blocks) {
        if (block) timestamps.set(Number(block.number), Number(block.timestamp));
      }
      for (const e of decoded) {
        const ts = timestamps.get(e.blockNumber) ?? 0;
        e.blockTimestampUnix = ts;
        e.blockTimestamp = ts ? new Date(ts * 1000).toISOString() : "";
      }

      return decoded;
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
        const left = await fetchChunk(fromBlock, mid, clientIndex);
        const right = await fetchChunk(mid + 1n, toBlock, clientIndex);
        return [...left, ...right];
      }

      if (isRateLimit && attempt < retries) {
        const wait = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      return [];
    }
  }
  return [];
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Uso: tsx src/check-blocks.ts <fromBlock> <toBlock>");
    process.exit(1);
  }

  const fromBlock = BigInt(args[0]);
  const toBlock = BigInt(args[1]);

  if (fromBlock > toBlock) {
    console.error("fromBlock debe ser menor o igual a toBlock");
    process.exit(1);
  }

  const range = toBlock - fromBlock + 1n;
  console.error(`Buscando eventos ${fromBlock} → ${toBlock} (${range} bloques)...`);

  const startTime = Date.now();

  const CHUNK_SIZE = 800n;
  const chunks: { from: bigint; to: bigint }[] = [];
  for (let b = fromBlock; b <= toBlock; b += CHUNK_SIZE) {
    const end = b + CHUNK_SIZE - 1n > toBlock ? toBlock : b + CHUNK_SIZE - 1n;
    chunks.push({ from: b, to: end });
  }

  console.error(`Total chunks: ${chunks.length}`);

  let totalEvents = 0;
  const uniqueOrderIds = new Set<number>();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const events = await fetchChunk(chunk.from, chunk.to, i % RPC_URLS.length);
    totalEvents += events.length;
    for (const e of events) uniqueOrderIds.add(e.orderId);

    const pct = (((i + 1) / chunks.length) * 100).toFixed(1);
    console.error(
      `  ${i + 1}/${chunks.length} (${pct}%) | eventos: ${events.length} | total: ${totalEvents}`,
    );

    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 200));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`Tiempo: ${elapsed}s`);

  console.log(`${totalEvents} eventos | ${uniqueOrderIds.size} ordenes unicas`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
