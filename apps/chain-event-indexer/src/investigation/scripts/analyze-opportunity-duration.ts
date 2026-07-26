import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { asc } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  console.log("=================================================================");
  console.log("⏱️ ANÁLISIS DE DURACIÓN DE BRECHAS DE OPORTUNIDAD EN D1");
  console.log("=================================================================\n");

  // 1. Obtener todos los precios por bloque ordenados por bloque
  const prices = await db
    .select()
    .from(schema.blockPrices)
    .orderBy(asc(schema.blockPrices.blockNumber));

  console.log(`📊 Total de bloques con precios registrados en D1: ${prices.length}`);

  if (prices.length < 2) {
    console.log("Se necesitan más bloques indexados en D1 para calcular la duración promedio de brecha.");
    return;
  }

  // 2. Identificar bloques donde el precio del contrato CAMBIÓ (Transacción setPriceConfig)
  type PriceChange = {
    blockNumber: number;
    buyPrice: number;
    sellPrice: number;
    timestamp: string;
    unixTs: number;
  };

  const changes: PriceChange[] = [];
  for (let i = 0; i < prices.length; i++) {
    const curr = prices[i];
    const prev = prices[i - 1];

    if (!prev || curr.buyPrice !== prev.buyPrice || curr.sellPrice !== prev.sellPrice) {
      changes.push({
        blockNumber: curr.blockNumber,
        buyPrice: curr.buyPrice,
        sellPrice: curr.sellPrice,
        timestamp: curr.blockTimestamp,
        unixTs: curr.blockTimestampUnix,
      });
    }
  }

  console.log(`📈 Cambios de tasa (setPriceConfig) detectados en los bloques guardados: ${changes.length}\n`);

  if (changes.length < 2) {
    console.log("Actualmente los bloques guardados corresponden a un mismo nivel de tasa. A medida que corra el indexer y registre más actualizaciones de precio, verás la duración exacta entre cada ajuste.");
    return;
  }

  // 3. Calcular la duración (tiempo y bloques) entre cada cambio de tasa
  const durationsSec: number[] = [];
  const durationsBlocks: number[] = [];

  console.log("📋 HISTORIAL DE DURACIÓN DE TASAS (VENTANAS DE TIEMPO ENTRE AJUSTES):");
  console.log("---------------------------------------------------------------------------------------------------------");

  for (let i = 1; i < changes.length; i++) {
    const prevChange = changes[i - 1];
    const currChange = changes[i];

    const blockDiff = currChange.blockNumber - prevChange.blockNumber;
    const timeDiffSec = currChange.unixTs - prevChange.unixTs;

    durationsBlocks.push(blockDiff);
    if (timeDiffSec > 0) durationsSec.push(timeDiffSec);

    const minutes = (timeDiffSec / 60).toFixed(1);
    console.log(
      ` Bloque ${prevChange.blockNumber} → ${currChange.blockNumber} (${blockDiff} bloques) | ` +
      `Duración: ${timeDiffSec} seg (~${minutes} min) | ` +
      `Tasa Compra: ${prevChange.buyPrice} ➔ ${currChange.buyPrice} VES`
    );
  }

  // 4. Promedios
  const avgSec = durationsSec.length > 0 ? durationsSec.reduce((a, b) => a + b, 0) / durationsSec.length : 0;
  const avgBlocks = durationsBlocks.length > 0 ? durationsBlocks.reduce((a, b) => a + b, 0) / durationsBlocks.length : 0;

  console.log("\n=================================================================");
  console.log("📊 RESULTADOS PROMEDIO DE LA DURACIÓN DE LAS BRECHAS:");
  console.log(` ⏱️ Tiempo Promedio de Duración de Tasa: ${avgSec.toFixed(1)} segundos (~${(avgSec / 60).toFixed(2)} minutos)`);
  console.log(` 📦 Bloques Promedio entre Ajustes: ${avgBlocks.toFixed(0)} bloques en Base Mainnet`);
  console.log("=================================================================");
}

main().catch(console.error);
