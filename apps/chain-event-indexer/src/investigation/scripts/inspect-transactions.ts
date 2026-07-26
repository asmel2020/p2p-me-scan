import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { fetchBlockEvents } from "../../shared/events";
import { between } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  const fromBlock = 49111389;
  const toBlock = 49111614;

  console.log(
    `=== ANALIZANDO TRANSACCIONES Y EVENTOS (${fromBlock} → ${toBlock}) ===\n`,
  );

  const events = await db
    .select()
    .from(schema.orderEvents)
    .where(between(schema.orderEvents.blockNumber, fromBlock, toBlock));

  const prices = await db
    .select()
    .from(schema.blockPrices)
    .where(between(schema.blockPrices.blockNumber, fromBlock, toBlock));

  const pricesMap = new Map(prices.map((p) => [p.blockNumber, p]));

  console.log(`📊 Total de eventos en el rango: ${events.length}`);
  console.log(`📈 Total de registros de precios: ${prices.length}\n`);

  for (const e of events) {
    const p = pricesMap.get(e.blockNumber);
    console.log(
      `[Bloque ${e.blockNumber}] Evento: ${e.eventName} | Orden #${e.orderId} | Tipo: ${e.orderType} | USDC: $${e.usdc} | Fiat: ${e.fiat} | Precio Bloque: Buy ${p?.buyPrice ?? "?"} / Sell ${p?.sellPrice ?? "?"} | Tx: ${e.txHash}`,
    );
  }
}

main().catch(console.error);
