import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { createClient, RPC_URLS } from "../../shared/rpc-config";
import { type Address, parseAbiItem } from "viem";
import { gte, lte, and } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);
const publicClient = createClient(RPC_URLS[0]);

const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const TARGET_INTERMEDIARY = "0xc26375024af88d9288bea15791f136b9640de8de";
const BINANCE_HOT_WALLET_2 = "0xee7ae85f2fe2239e27d9c1e23ffe168d63b4055";

const TRANSFER_EVENT_ABI = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

async function main() {
  console.log("=================================================================");
  console.log("🔍 INSPECCIÓN DE BILLETERAS INTERMEDIAS Y DESTINOS DE CADA TOP WALLET");
  console.log("=================================================================\n");

  const fromDate = "2026-07-19T00:00:00.000Z";
  const toDate = "2026-07-26T23:59:59.999Z";

  const orders = await db
    .select()
    .from(schema.orders)
    .where(and(gte(schema.orders.blockTimestamp, fromDate), lte(schema.orders.blockTimestamp, toDate)));

  const buyOrders = orders.filter((o) => o.status === "completed" && o.orderType === "BUY" && o.user && o.user !== "-");

  const userMap = new Map<string, number>();
  for (const o of buyOrders) {
    const user = o.user.toLowerCase();
    userMap.set(user, (userMap.get(user) ?? 0) + o.usdc);
  }

  const topBuyers = [...userMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const currentBlock = await publicClient.getBlockNumber();
  const fromBlock = currentBlock - 100000n;

  console.log(`📋 Rastrenado destinos de las Top ${topBuyers.length} billeteras compradoras:\n`);

  for (const [user, totalVol] of topBuyers) {
    const addr = user as Address;
    const logs = await publicClient.getLogs({
      address: USDC_ADDRESS_BASE,
      event: TRANSFER_EVENT_ABI,
      args: { from: addr },
      fromBlock,
      toBlock: currentBlock,
    });

    const destMap = new Map<string, number>();
    for (const l of logs) {
      const to = (l.args.to as string).toLowerCase();
      const val = Number(l.args.value) / 1e6;
      destMap.set(to, (destMap.get(to) ?? 0) + val);
    }

    console.log(`👤 Billetera: ${user} | Vol Compras: $${totalVol.toFixed(2)} USDC`);
    if (destMap.size === 0) {
      console.log(`   └─ No tiene transferencias salientes en los últimos 100,000 bloques.`);
    }
    for (const [dest, val] of destMap.entries()) {
      let tag = "";
      if (dest === TARGET_INTERMEDIARY) tag = " 👈 [BILLETERA INTERMEDIA COMPARTIDA (0xC263...8de)]";
      else if (dest === BINANCE_HOT_WALLET_2) tag = " 🏢 [BINANCE HOT WALLET 2 DIRECTO]";
      else tag = ` 🔗 [Billetera Propia / Intermedia de esta Wallet]`;

      console.log(`   └─ Envió $${val.toFixed(2)} USDC a: ${dest}${tag}`);
    }
    console.log("");
  }
}

main().catch(console.error);
