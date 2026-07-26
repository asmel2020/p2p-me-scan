import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../shared/env";
import { fetchBlockEvents } from "../shared/events";
import { eq, between } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  const fromBlock = 49111389;
  const toBlock = 49111614;

  console.log(`=== ANALIZANDO TRANSACCIONES Y EVENTOS (${fromBlock} → ${toBlock}) ===\n`);

  // 1. Obtener eventos guardados en D1
  const events = await db
    .select()
    .from(schema.orderEvents)
    .where(between(schema.orderEvents.blockNumber, fromBlock, toBlock));

  // 2. Obtener precios guardados en D1
  const prices = await db
    .select()
    .from(schema.blockPrices)
    .where(between(schema.blockPrices.blockNumber, fromBlock, toBlock));

  const pricesMap = new Map(prices.map((p) => [p.blockNumber, p]));

  console.log(`📊 Total de eventos en el rango: ${events.length}`);
  console.log(`📈 Total de registros de precios: ${prices.length}\n`);

  if (events.length === 0) {
    console.log("No hay eventos de órdenes en D1 para este rango. Escaneando la blockchain directamente...");
    const chainEvents: any[] = [];
    for (let b = BigInt(fromBlock); b <= BigInt(toBlock); b++) {
      const evs = await fetchBlockEvents(b);
      chainEvents.push(...evs);
    }
    console.log(`Blockchain scan: ${chainEvents.length} eventos encontrados.`);
    for (const e of chainEvents) {
      const p = pricesMap.get(e.blockNumber);
      console.log(
        `[Bloque ${e.blockNumber}] Evento: ${e.eventName} | Orden #${e.orderId} | User: ${e.user.slice(0, 8)}... | USDC: $${e.usdc} | Fiat: ${e.fiat} VES | Precio Bloque: Buy ${p?.buyPrice ?? "?"} / Sell ${p?.sellPrice ?? "?"} | Tx: ${e.txHash}`
      );
    }
  } else {
    for (const e of events) {
      const p = pricesMap.get(e.blockNumber);
      console.log(
        `[Bloque ${e.blockNumber}] Evento: ${e.eventName} | Orden #${e.orderId} | Tipo: ${e.orderType} | USDC: $${e.usdc} | Fiat: ${e.fiat} | Precio Bloque: Buy ${p?.buyPrice ?? "?"} / Sell ${p?.sellPrice ?? "?"} | Tx: ${e.txHash}`
      );
    }
  }
}

main().catch(console.error);
