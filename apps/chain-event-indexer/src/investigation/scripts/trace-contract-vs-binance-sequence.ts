import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { and, gte, lte, asc } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

function toVetTimeString(isoStr: string): string {
  if (!isoStr) return "-";
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return isoStr;
  const vetDate = new Date(date.getTime() - 4 * 60 * 60 * 1000);
  const hours = vetDate.getUTCHours().toString().padStart(2, "0");
  const minutes = vetDate.getUTCMinutes().toString().padStart(2, "0");
  const seconds = vetDate.getUTCSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds} VET`;
}

async function main() {
  console.log("=================================================================");
  console.log("🔬 CRONOLOGÍA SECUENCIAL: CONTRATO (860.9 ➔ 870.0) VS BINANCE P2P");
  console.log("=================================================================\n");

  const startBlock = 49140730; // ~09:00 VET
  const endBlock = 49141200;   // ~09:16 VET

  const prices = await db
    .select()
    .from(schema.blockPrices)
    .where(
      and(
        gte(schema.blockPrices.blockNumber, startBlock),
        lte(schema.blockPrices.blockNumber, endBlock)
      )
    )
    .orderBy(asc(schema.blockPrices.blockNumber));

  let lastContractBuy = 0;
  let lastBinanceSell = 0;

  prices.forEach((bp) => {
    if (bp.buyPrice !== lastContractBuy || bp.binanceSellPrice !== lastBinanceSell) {
      lastContractBuy = bp.buyPrice;
      lastBinanceSell = bp.binanceSellPrice;

      const diff = bp.binanceSellPrice - bp.buyPrice;
      const margin = (diff / bp.buyPrice) * 100;
      const status = margin > 0 ? `🟢 BRECHA LADO 1 (+${margin.toFixed(2)}%)` : `🔴 SIN BRECHA LADO 1 (${margin.toFixed(2)}%)`;

      console.log(
        ` ⏰ ${toVetTimeString(bp.blockTimestamp || bp.createdAt)} (Bloque ${bp.blockNumber})\n` +
        `    ├─ Contrato Compra: ${bp.buyPrice} VES\n` +
        `    ├─ Binance Venta:   ${bp.binanceSellPrice} VES\n` +
        `    └─ Estado: ${status}\n`
      );
    }
  });
}

main().catch(console.error);
