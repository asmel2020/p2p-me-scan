import fs from "fs";
import path from "path";
import { decodeLog, ORDER_EVENT_ABI, DIAMOND_ADDRESS, type ChainEvent } from "../shared/events";
import { initRemoteDB } from "@p2p-me/db/client";
import { persistEvent } from "../shared/db/store";
import { RPC_URLS, createClient, logRpcError } from "../shared/rpc-config";
import { getCloudflareEnv } from "../shared/env";
import { DATA_DIR } from "../shared/rpc-config";

const { accountId, databaseId, apiToken } = getCloudflareEnv();

const clients = RPC_URLS.map(createClient);

async function fetchBlockEvents(blockNumber: bigint): Promise<ChainEvent[]> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let ci = 0; ci < clients.length; ci++) {
      try {
        const logs = await clients[ci].getLogs({
          address: DIAMOND_ADDRESS as any,
          events: ORDER_EVENT_ABI,
          fromBlock: blockNumber,
          toBlock: blockNumber,
        });
        if (logs.length === 0) return [];

        const decoded: ChainEvent[] = [];
        for (const log of logs as any[]) {
          const e = decodeLog(log);
          if (e) decoded.push(e);
        }

        const block = await clients[ci].getBlock({ blockNumber }).catch(() => null);
        const ts = block ? Number(block.timestamp) : 0;
        for (const e of decoded) {
          e.blockTimestampUnix = ts;
          e.blockTimestamp = ts ? new Date(ts * 1000).toISOString() : "";
        }

        return decoded;
      } catch (err: any) {
        lastErr = err;
        const isRateLimit =
          err.message?.includes("rate limit") ||
          err.message?.includes("429") ||
          err.message?.includes("over rate limit");
        if (isRateLimit) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000 + Math.random() * 2000));
        }
      }
    }
  }
  throw lastErr ?? new Error("No se pudo obtener eventos del bloque");
}

async function main() {
  const failedFilePath = path.resolve(DATA_DIR, "failed-blocks.json");
  if (!fs.existsSync(failedFilePath)) {
    console.error(`No se encuentra ${failedFilePath}`);
    process.exit(1);
  }

  const { failedBlocks } = JSON.parse(fs.readFileSync(failedFilePath, "utf-8")) as {
    failedBlocks: string[];
  };

  if (!failedBlocks || failedBlocks.length === 0) {
    console.log("No hay bloques fallidos para reprocesar");
    return;
  }

  console.log(`Reprocesando ${failedBlocks.length} bloques fallidos...\n`);

  const db = initRemoteDB(accountId, databaseId, apiToken);

  let totalEvents = 0;
  const stillFailing: string[] = [];

  for (let i = 0; i < failedBlocks.length; i++) {
    const block = BigInt(failedBlocks[i]);
    try {
      const events = await fetchBlockEvents(block);
      if (events.length > 0) {
        await Promise.all(events.map((e) => persistEvent(db, e)));
        totalEvents += events.length;
      }
      console.log(`  ${i + 1}/${failedBlocks.length} | Bloque ${block}: ${events.length} eventos`);
    } catch (err: any) {
      console.error(`  ${i + 1}/${failedBlocks.length} | Bloque ${block}: ERROR ${err.message}`);
      stillFailing.push(failedBlocks[i]);
    }
  }

  console.log(`\nTotal eventos recuperados: ${totalEvents}`);

  if (stillFailing.length > 0) {
    const failedFile = path.resolve(DATA_DIR, "failed-blocks.json");
    fs.writeFileSync(
      failedFile,
      JSON.stringify(
        { failedBlocks: stillFailing, total: stillFailing.length, timestamp: new Date().toISOString() },
        null,
        2,
      ),
    );
    console.error(`Aun fallan ${stillFailing.length} bloques, guardados en ${failedFile}`);
  } else {
    if (fs.existsSync(failedFilePath)) {
      fs.unlinkSync(failedFilePath);
    }
    console.log("Todos los bloques fallidos se recuperaron exitosamente");
  }
}

main().catch(console.error);
