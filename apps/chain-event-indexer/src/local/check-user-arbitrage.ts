import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../shared/env";
import { inArray, eq, or } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  const targetOrderIds = [
    638172, 638173, 638174, 638175, 638176, 638177, 638178, 638179,
    638180, 638181, 638182, 638183, 638184, 638185,
  ];

  console.log("=== VERIFICANDO USUARIOS Y MERCHANTS EN EL RANGO DE ÓRDENES ===\n");

  // 1. Obtener los detalles de las órdenes objetivo
  const orders = await db
    .select()
    .from(schema.orders)
    .where(inArray(schema.orders.orderId, targetOrderIds));

  console.log(`📋 Detalle de las ${orders.length} órdenes analizadas:\n`);

  const userCounts = new Map<string, number>();
  const merchantCounts = new Map<string, number>();
  const uniqueUsers = new Set<string>();
  const uniqueMerchants = new Set<string>();

  for (const o of orders) {
    console.log(
      `Orden #${o.orderId} | Tipo: ${o.orderType} | User: ${o.user} | Merchant: ${o.merchant} | AcceptedMerchant: ${o.acceptedMerchant} | Status: ${o.status} | USDC: $${o.usdc} | Fiat: ${o.fiat}`
    );

    if (o.user && o.user !== "-") {
      uniqueUsers.add(o.user);
      userCounts.set(o.user, (userCounts.get(o.user) ?? 0) + 1);
    }
    if (o.merchant && o.merchant !== "-") {
      uniqueMerchants.add(o.merchant);
      merchantCounts.set(o.merchant, (merchantCounts.get(o.merchant) ?? 0) + 1);
    }
    if (o.acceptedMerchant && o.acceptedMerchant !== "-") {
      uniqueMerchants.add(o.acceptedMerchant);
      merchantCounts.set(o.acceptedMerchant, (merchantCounts.get(o.acceptedMerchant) ?? 0) + 1);
    }
  }

  console.log("\n========================================================");
  console.log("📊 RESUMEN DE USUARIOS (USERS):");
  for (const [user, count] of userCounts.entries()) {
    console.log(`  - User: ${user} → ${count} órdenes`);
  }

  console.log("\n📊 RESUMEN DE MERCHANTS:");
  for (const [merchant, count] of merchantCounts.entries()) {
    console.log(`  - Merchant: ${merchant} → ${count} intervenciones`);
  }

  // 2. Buscar el historial completo de los usuarios más activos en la base de datos
  console.log("\n========================================================");
  console.log("📜 HISTORIAL COMPLETO DE LOS USUARIOS EN LA DB:");

  for (const user of uniqueUsers) {
    const userHistory = await db
      .select()
      .from(schema.orders)
      .where(or(eq(schema.orders.user, user), eq(schema.orders.merchant, user), eq(schema.orders.acceptedMerchant, user)));

    console.log(`\n👤 Historial de ${user} (${userHistory.length} órdenes en total en la DB):`);
    for (const h of userHistory) {
      console.log(
        `   • Orden #${h.orderId} | Tipo: ${h.orderType} | Status: ${h.status} | USDC: $${h.usdc} | Fiat: ${h.fiat} | Bloque Creado: ${h.createdBlock}`
      );
    }
  }
}

main().catch(console.error);
