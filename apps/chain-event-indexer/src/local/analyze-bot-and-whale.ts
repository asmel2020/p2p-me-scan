import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../shared/env";
import { inArray, between, asc } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  const botUser = "0x0776852ef593cabd26ae43765f22179e89c41178";
  const whaleUser = "0x58903b37754acb59b686e97d94409d68375ac2d2";

  console.log("=== ANALIZANDO CORRELACIÓN TEMPORAL: BOT SOSPECHOSO vs TOP 1 COMPRADOR ===\n");

  // 1. Obtener todas las órdenes del bot sospechoso ordenadas por timestamp
  const botOrders = await db
    .select()
    .from(schema.orders)
    .where(inArray(schema.orders.user, [botUser]))
    .orderBy(asc(schema.orders.createdBlock));

  // 2. Obtener todas las órdenes del top 1 ordenadas por timestamp
  const whaleOrders = await db
    .select()
    .from(schema.orders)
    .where(inArray(schema.orders.user, [whaleUser]))
    .orderBy(asc(schema.orders.createdBlock));

  console.log(`🤖 Bot sospechoso (${botUser}): ${botOrders.length} órdenes en total`);
  console.log(`🐋 Top 1 Whale (${whaleUser}): ${whaleOrders.length} órdenes en total\n`);

  console.log("========================================================");
  console.log("Timeline cronológico del Bot sospechoso:");
  botOrders.forEach((b) => {
    console.log(
      `  [Bloque ${b.createdBlock}] [${b.blockTimestamp}] Orden #${b.orderId} | Tipo: ${b.orderType} | Status: ${b.status} | USDC: $${b.usdc} | Fiat: ${b.fiat}`
    );
  });

  console.log("\n========================================================");
  console.log("Timeline cronológico del Top 1 Comprador:");
  whaleOrders.forEach((w) => {
    console.log(
      `  [Bloque ${w.createdBlock}] [${w.blockTimestamp}] Orden #${w.orderId} | Tipo: ${w.orderType} | Status: ${w.status} | USDC: $${w.usdc} | Fiat: ${w.fiat}`
    );
  });

  // 3. Buscar ráfagas / clusters donde ambos operaron cerca en el mismo rango de bloques
  console.log("\n========================================================");
  console.log("⚡ RÁFAGAS DONDE EL BOT CANCELA Y EL TOP 1 METE ÓRDENES (Mismo rango de bloques):");

  for (const b of botOrders) {
    // Buscar órdenes del Top 1 en un rango de +- 500 bloques (~15 mins) del evento del bot
    const nearbyWhaleOrders = whaleOrders.filter(
      (w) => Math.abs(w.createdBlock - b.createdBlock) <= 500
    );

    if (nearbyWhaleOrders.length > 0) {
      console.log(`\n📌 Coincidencia cerca del bloque ${b.createdBlock} (${b.blockTimestamp}):`);
      console.log(`   - Bot sospechoso creó/canceló Orden #${b.orderId} (Status: ${b.status}, $${b.usdc})`);
      for (const w of nearbyWhaleOrders) {
        const diffBlocks = w.createdBlock - b.createdBlock;
        const diffSecs = diffBlocks * 2;
        console.log(
          `   👉 Top 1 Whale metió Orden #${w.orderId} (${diffBlocks > 0 ? "+" : ""}${diffBlocks} bloques / ~${diffSecs}s) | Status: ${w.status} | USDC: $${w.usdc}`
        );
      }
    }
  }
}

main().catch(console.error);
