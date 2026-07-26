import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../shared/env";
import { eq, or } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  // Buscar las órdenes de la orden #637905 para obtener la dirección exacta del usuario
  const sampleOrder = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.orderId, 637905))
    .limit(1);

  if (!sampleOrder[0]) {
    console.error("No se encontró la orden muestra");
    return;
  }

  const targetUser = sampleOrder[0].user;
  console.log(`=== ANALIZANDO GANANCIAS Y PATRÓN DEL USUARIO PRINCIPAL ===`);
  console.log(`👤 Dirección: ${targetUser}\n`);

  // Obtener todo el historial de este usuario
  const allOrders = await db
    .select()
    .from(schema.orders)
    .where(
      or(
        eq(schema.orders.user, targetUser),
        eq(schema.orders.merchant, targetUser),
        eq(schema.orders.acceptedMerchant, targetUser)
      )
    );

  let totalUsdcBought = 0;
  let totalFiatPaidForBuy = 0;

  let totalUsdcSold = 0;
  let totalFiatReceivedForSell = 0;

  let completedBuyCount = 0;
  let completedSellCount = 0;

  console.log(`📜 Historial completo (${allOrders.length} órdenes):\n`);

  for (const o of allOrders) {
    if (o.status !== "completed") continue;

    const rate = o.usdc > 0 ? (o.fiat / o.usdc).toFixed(2) : "0";

    if (o.orderType === "BUY") {
      completedBuyCount++;
      totalUsdcBought += o.usdc;
      totalFiatPaidForBuy += o.fiat;
      console.log(
        `🟢 [COMPRA] Orden #${o.orderId} | USDC: $${o.usdc} | Fiat: ${o.fiat} VES | Tasa: ${rate} VES/USDC | Bloque: ${o.createdBlock}`
      );
    } else if (o.orderType === "SELL") {
      completedSellCount++;
      totalUsdcSold += o.usdc;
      totalFiatReceivedForSell += o.fiat;
      console.log(
        `🔴 [VENTA] Orden #${o.orderId} | USDC: $${o.usdc} | Fiat: ${o.fiat} VES | Tasa: ${rate} VES/USDC | Bloque: ${o.createdBlock}`
      );
    }
  }

  const avgBuyRate = totalUsdcBought > 0 ? (totalFiatPaidForBuy / totalUsdcBought).toFixed(2) : "0";
  const avgSellRate = totalUsdcSold > 0 ? (totalFiatReceivedForSell / totalUsdcSold).toFixed(2) : "0";

  console.log("\n========================================================");
  console.log("📈 RESUMEN FINANCIERO DEL USUARIO:");
  console.log(`  • Órdenes de Compra Completadas: ${completedBuyCount}`);
  console.log(`    - Total USDC Comprado: $${totalUsdcBought.toFixed(2)}`);
  console.log(`    - Total Fiat Pagado: ${totalFiatPaidForBuy.toFixed(2)} VES`);
  console.log(`    - Tasa Promedio de Compra: ${avgBuyRate} VES/USDC`);

  console.log(`\n  • Órdenes de Venta Completadas: ${completedSellCount}`);
  console.log(`    - Total USDC Vendido: $${totalUsdcSold.toFixed(2)}`);
  console.log(`    - Total Fiat Recibido: ${totalFiatReceivedForSell.toFixed(2)} VES`);
  console.log(`    - Tasa Promedio de Venta: ${avgSellRate} VES/USDC`);

  console.log("\n========================================================");
  console.log("💡 ESTRATEGIA Y GANANCIA ESTIMADA:");
  if (completedBuyCount > 0 && completedSellCount > 0) {
    const rateDiff = Number(avgSellRate) - Number(avgBuyRate);
    console.log(`  • Diferencial Promedio (Venta - Compra): ${rateDiff.toFixed(2)} VES por USDC`);
  }
}

main().catch(console.error);
