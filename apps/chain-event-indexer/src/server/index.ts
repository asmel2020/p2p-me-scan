import { startBlockPoller } from "./block-poller";
import { fetchBlockEvents } from "../shared/events";
import { initRemoteDB } from "@p2p-me/db/client";
import { persistEvent } from "../shared/db/store";
import { getLastBlock, setLastBlock } from "../shared/db/state";
import { fastCatchup } from "./catchup";
import { createClient, RPC_URLS } from "../shared/rpc-config";
import { getCloudflareEnv } from "../shared/env";

const { accountId, databaseId, apiToken } = getCloudflareEnv();

const publicClient = createClient(RPC_URLS[0]);

const LOOKBACK = 1000n;
const CATCHUP_THRESHOLD = 100n;

async function main() {
  const db = initRemoteDB(accountId, databaseId, apiToken);

  const savedBlock = await getLastBlock(db);
  let startBlock: bigint | undefined;

  if (savedBlock) {
    startBlock = savedBlock + 1n;
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
    await setLastBlock(db, blockNumber);
  });

  console.log(
    `Indexer iniciado — escuchando nuevos bloques en Base Mainnet...`,
  );
}

main().catch(console.error);
