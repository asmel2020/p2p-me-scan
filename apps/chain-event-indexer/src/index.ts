import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { createPublicClient, http } from "viem";
import { startBlockPoller } from "./block-poller";
import { fetchBlockEvents } from "./events";
import { initRemoteDB } from "@p2p-me/db/client";
import { persistEvent } from "./db/store";
import { getLastBlock, setLastBlock } from "./db/state";
import { fastCatchup } from "./catchup";

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

const ACCOUNT_ID = CLOUDFLARE_ACCOUNT_ID!;
const DB_ID = CLOUDFLARE_DATABASE_ID!;
const API_TOKEN = CLOUDFLARE_API_TOKEN!;

const publicClient = createPublicClient({
  transport: http(
    "https://rpc.ankr.com/base/9676e91ab178d118be498a3fa0f25ea5499e26bbfa8126ec2b1119d0238b4e02",
  ),
});

const LOOKBACK = 1000n;

async function main() {
  const db = initRemoteDB(ACCOUNT_ID, DB_ID, API_TOKEN);

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
  const CATCHUP_THRESHOLD = 100n;

  if (gap > CATCHUP_THRESHOLD) {
    await fastCatchup(db, startBlock, currentBlock);
    startBlock = currentBlock;
  }

  const poller = startBlockPoller(2000, startBlock);

  poller.onBlock(async (blockNumber) => {
    console.log(`Procesando bloque ${blockNumber}`);
    const events = await fetchBlockEvents(blockNumber);
    console.log(`Bloque ${blockNumber} procesado`);
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
