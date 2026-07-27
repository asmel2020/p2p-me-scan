import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { and, gte, lte, asc, gt } from "drizzle-orm";
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
  console.log("🔬 BÚSQUEDA AMPLIADA DEL MOMENTO EN QUE EL CONTRATO SUBIÓ SU TASA");
  console.log("=================================================================\n");

  const peakBlock = 49140737; // 09:00:21 VET - Binance alcanza 890.63 VES
  const initialContractPrice = 860.9;

  // Buscar en los siguientes 3,000 bloques (~1.6 horas) cuándo cambió buyPrice del contrato
  const nextPriceChange = await db
    .select()
    .from(schema.blockPrices)
    .where(
      and(
        gt(schema.blockPrices.blockNumber, peakBlock),
        gt(schema.blockPrices.buyPrice, initialContractPrice)
      )
    )
    .orderBy(asc(schema.blockPrices.blockNumber))
    .limit(5);

  if (nextPriceChange.length > 0) {
    const updatedBp = nextPriceChange[0];
    const elapsedBlocks = updatedBp.blockNumber - peakBlock;
    const elapsedSecs = elapsedBlocks * 2;
    const elapsedMins = (elapsedSecs / 60).toFixed(1);

    console.log(`🚀 REVELACIÓN ABSOLUTA:`);
    console.log(` ├─ Binance P2P subió a 890.63 VES a las: 09:00:21 VET (Bloque ${peakBlock})`);
    console.log(` ├─ El Contrato permaneció CONGELADO en 860.90 VES hasta las: ${toVetTimeString(updatedBp.blockTimestamp || updatedBp.createdAt)} (Bloque ${updatedBp.blockNumber})`);
    console.log(` ├─ Nueva Tasa a la que actualizó el Contrato: ${updatedBp.buyPrice} VES`);
    console.log(` └─ ⏱️ TIEMPO EXACTO QUE TARDÓ EL CONTRATO EN SUBIR SU PRECIO:`);
    console.log(`    👉 ${elapsedSecs} SEGUNDOS = ${elapsedMins} MINUTOS (${elapsedBlocks} BLOQUES DE RETRASO)\n`);
  } else {
    console.log(" ℹ️ La tasa del contrato continuó congelada en 860.90 VES durante toda la muestra posterior.");
  }
}

main().catch(console.error);
