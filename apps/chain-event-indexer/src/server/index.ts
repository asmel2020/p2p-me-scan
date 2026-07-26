import { startBlockPoller } from "./block-poller";
import { fetchBlockEvents } from "../shared/events";
import { initRemoteDB } from "@p2p-me/db/client";
import { persistEvent } from "../shared/db/store";
import { getLastBlock, setLastBlock } from "../shared/db/state";
import { persistBlockPrices } from "../shared/db/price-store";
import { checkArbitrageForBlock } from "../arbitrage-bot/monitor";
import { startTelegramCommandListener } from "../arbitrage-bot/telegram";

startTelegramCommandListener();
import { fastCatchup } from "./catchup";
import { createClient, RPC_URLS } from "../shared/rpc-config";
import { getCloudflareEnv } from "../shared/env";
import { fetchAllPricesAtBlock } from "../shared/price";

const { accountId, databaseId, apiToken } = getCloudflareEnv();

const publicClient = createClient(RPC_URLS[0]);

const LOOKBACK = 1000n; //1800n * 24n * 1n;
const CATCHUP_THRESHOLD = 100n;

async function main() {
  const db = initRemoteDB(accountId, databaseId, apiToken);

  const savedBlock = await getLastBlock(db);
  let startBlock: bigint | undefined;

  if (savedBlock) {
    startBlock = savedBlock - 10n;
    console.log(`Reanudando desde el bloque ${savedBlock}`);
  } else {
    const current = await publicClient.getBlockNumber();
    startBlock = current - LOOKBACK;
    console.log(`Sin estado guardado. Iniciando desde bloque ${startBlock}`);
  }

  const currentBlock = await publicClient.getBlockNumber();
  const gap = currentBlock - startBlock;

  if (gap > CATCHUP_THRESHOLD) {
    await fastCatchup(db, startBlock, currentBlock);
    startBlock = currentBlock;
  }

  const poller = startBlockPoller(2000, startBlock);

  poller.onBlock(async (blockNumber) => {
    const events = await fetchBlockEvents(blockNumber);

    if (events.length > 0) {
      for (const e of events) {
        await persistEvent(db, e);
      }
    }

    // Indexar precio fiat de CADA bloque (tenga o no eventos)
    try {
      let blockTimestampIso = "";
      let blockTimestampUnix = 0;

      if (events.length > 0) {
        blockTimestampIso = events[0].blockTimestamp;
        blockTimestampUnix = events[0].blockTimestampUnix;
      } else {
        const block = await publicClient.getBlock({ blockNumber });
        blockTimestampUnix = Number(block.timestamp);
        blockTimestampIso = new Date(blockTimestampUnix * 1000).toISOString();
      }

      const prices = await fetchAllPricesAtBlock(blockNumber);
      if (prices.length > 0) {
        await persistBlockPrices(
          db,
          Number(blockNumber),
          prices,
          blockTimestampIso,
          blockTimestampUnix,
        );

        // Evaluar arbitraje en tiempo real reutilizando los precios en memoria (0 RPCs extra) y guardar oportunidad en D1
        checkArbitrageForBlock(
          blockNumber,
          prices[0].buyPrice,
          prices[0].sellPrice,
          db,
          blockTimestampIso,
        ).catch(console.error);
      }
    } catch (err) {
      console.error(
        `Error indexando precio en bloque ${blockNumber}:`,
        (err as any)?.message ?? err,
      );
    }

    await setLastBlock(db, blockNumber);
  });

  console.log(
    `Indexer iniciado — escuchando nuevos bloques en Base Mainnet...`,
  );
}

main().catch(console.error);
