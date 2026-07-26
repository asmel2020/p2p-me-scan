import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../shared/env";
import { eq, gte, asc } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  const whaleUser = "0x58903b37754acb59b686e97d94409d68375ac2d2";

  console.log("=== ANALIZANDO PRECIOS DEL WHALE EN BLOQUES INDEXADOS (25 DE JULIO) ===\n");

  const whaleOrders = await db
    .select()
    .from(schema.orders)
    .where(
      gte(schema.orders.createdBlock, 49110800)
    )
    .orderBy(asc(schema.orders.createdBlock));

  for (const o of whaleOrders) {
    if (o.user !== whaleUser) continue;
    if (o.status !== "completed") continue;

    // Buscar el precio de ese bloque
    const priceAtBlock = await db
      .select()
      .from(schema.blockPrices)
      .where(eq(schema.blockPrices.blockNumber, o.createdBlock))
      .limit(1);

    // Buscar el precio 50 bloques después (~1.6 minutos)
    const priceAfter50 = await db
      .select()
      .from(schema.blockPrices)
      .where(eq(schema.blockPrices.blockNumber, o.createdBlock + 50))
      .limit(1);

    // Buscar el precio 200 bloques después (~6.6 minutos)
    const priceAfter200 = await db
      .select()
      .from(schema.blockPrices)
      .where(eq(schema.blockPrices.blockNumber, o.createdBlock + 200))
      .limit(1);

    const orderRate = (o.fiat / o.usdc).toFixed(2);
    const pCurrent = priceAtBlock[0] ? `Buy ${priceAtBlock[0].buyPrice} / Sell ${priceAtBlock[0].sellPrice}` : "N/A";
    const p50 = priceAfter50[0] ? `Buy ${priceAfter50[0].buyPrice} / Sell ${priceAfter50[0].sellPrice}` : "N/A";
    const p200 = priceAfter200[0] ? `Buy ${priceAfter200[0].buyPrice} / Sell ${priceAfter200[0].sellPrice}` : "N/A";

    console.log(
      `📌 [Bloque ${o.createdBlock}] [${o.blockTimestamp}] Orden #${o.orderId} | Tipo: ${o.orderType} | USDC: $${o.usdc} | Tasa Orden: ${orderRate} VES`
    );
    console.log(`   ├─ Precio en Bloque de Creación: ${pCurrent}`);
    console.log(`   ├─ Precio 50 bloques después (~1.6m): ${p50}`);
    console.log(`   └─ Precio 200 bloques después (~6.6m): ${p200}\n`);
  }
}

main().catch(console.error);
