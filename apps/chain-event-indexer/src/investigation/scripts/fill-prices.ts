import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { fetchAllPricesAtBlock } from "../../shared/price";
import { persistBlockPrices } from "../../shared/db/price-store";
import { createClient, RPC_URLS } from "../../shared/rpc-config";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);
const publicClient = createClient(RPC_URLS[0]);

async function main() {
  const args = process.argv.slice(2);
  const fromBlock = BigInt(args[0] ?? "49111389");
  const toBlock = BigInt(args[1] ?? "49111614");

  const total = toBlock - fromBlock + 1n;
  console.log(`Llenando precios para bloques ${fromBlock} → ${toBlock} (total ${total} bloques)...`);

  let count = 0;
  for (let b = fromBlock; b <= toBlock; b++) {
    try {
      const block = await publicClient.getBlock({ blockNumber: b });
      const unixTs = Number(block.timestamp);
      const isoTs = new Date(unixTs * 1000).toISOString();

      const prices = await fetchAllPricesAtBlock(b);
      if (prices.length > 0) {
        await persistBlockPrices(db, Number(b), prices, isoTs, unixTs);
        count++;
        const pct = ((count / Number(total)) * 100).toFixed(1);
        console.log(`  [${count}/${total}] (${pct}%) Bloque ${b}: VEN Buy ${prices[0].buyPrice} / Sell ${prices[0].sellPrice}`);
      }
    } catch (err: any) {
      console.error(`Error en bloque ${b}:`, err?.message ?? err);
    }
  }

  console.log(`\n✅ Completado: ${count} bloques guardados en D1.`);
}

main().catch(console.error);
