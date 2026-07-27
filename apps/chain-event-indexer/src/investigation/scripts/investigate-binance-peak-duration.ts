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
  console.log("🔬 DURACIÓN EXACTA DEL PICO DE PRECIO EN BINANCE P2P (~890 VES)");
  console.log("=================================================================\n");

  const peakStartBlock = 49140737; // 09:00:21 VET (Binance P2P = 890.63 VES)

  // Obtener precios por bloque desde el pico en adelante (1,000 bloques)
  const prices = await db
    .select()
    .from(schema.blockPrices)
    .where(
      and(
        gte(schema.blockPrices.blockNumber, peakStartBlock),
        lte(schema.blockPrices.blockNumber, peakStartBlock + 1000)
      )
    )
    .orderBy(asc(schema.blockPrices.blockNumber));

  if (prices.length === 0) {
    console.log("ℹ️ No hay registros en ese rango.");
    return;
  }

  const startBp = prices[0];
  console.log(`📌 INICIO DEL PICO EN BINANCE (Bloque ${startBp.blockNumber} — ${toVetTimeString(startBp.blockTimestamp || startBp.createdAt)}):`);
  console.log(`   └─ Tasa Venta Binance P2P: ${startBp.binanceSellPrice} VES\n`);

  // Buscar el momento en que Binance bajó de 880.0 VES o de 870.0 VES
  let endPeak880Bp = prices.find((p) => p.binanceSellPrice < 880.0);
  let endPeak870Bp = prices.find((p) => p.binanceSellPrice < 870.0);

  if (endPeak880Bp) {
    const elapsedBlocks = endPeak880Bp.blockNumber - peakStartBlock;
    const elapsedSecs = elapsedBlocks * 2;
    const elapsedMins = (elapsedSecs / 60).toFixed(1);

    console.log(`📉 FIN DEL PICO > 880 VES EN BINANCE (Bloque ${endPeak880Bp.blockNumber} — ${toVetTimeString(endPeak880Bp.blockTimestamp || endPeak880Bp.createdAt)}):`);
    console.log(`   ├─ Nueva Tasa en Binance P2P: ${endPeak880Bp.binanceSellPrice} VES`);
    console.log(`   └─ ⏱️ TIEMPO QUE SE MANTUVO POR ENCIMA DE 880 VES:`);
    console.log(`      👉 ${elapsedSecs} SEGUNDOS (${elapsedMins} MINUTOS / ${elapsedBlocks} BLOQUES)\n`);
  }

  if (endPeak870Bp) {
    const elapsedBlocks = endPeak870Bp.blockNumber - peakStartBlock;
    const elapsedSecs = elapsedBlocks * 2;
    const elapsedMins = (elapsedSecs / 60).toFixed(1);

    console.log(`📉 CAÍDA POR DEBAJO DE 870 VES EN BINANCE (Bloque ${endPeak870Bp.blockNumber} — ${toVetTimeString(endPeak870Bp.blockTimestamp || endPeak870Bp.createdAt)}):`);
    console.log(`   ├─ Nueva Tasa en Binance P2P: ${endPeak870Bp.binanceSellPrice} VES`);
    console.log(`   └─ ⏱️ TIEMPO TOTAL EN ZONA ALTA DE BINANCE:`);
    console.log(`      👉 ${elapsedSecs} SEGUNDOS (${elapsedMins} MINUTOS / ${elapsedBlocks} BLOQUES)\n`);
  } else {
    console.log("ℹ️ Binance P2P se mantuvo en zona alta durante todo el muestreo posterior.");
  }

  console.log("=================================================================\n");
}

main().catch(console.error);
