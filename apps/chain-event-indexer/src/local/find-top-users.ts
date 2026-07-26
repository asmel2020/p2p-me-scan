import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../shared/env";
import { gte, lte, and, sql } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  console.log("=== BUSCANDO USUARIOS CON MAYOR VOLUMEN Y TRANSACCIONES (23, 24 y 25 de Julio) ===\n");

  // Filtrar órdenes por rango de fechas (2026-07-23 al 2026-07-25)
  const orders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        gte(schema.orders.blockTimestamp, "2026-07-23T00:00:00.000Z"),
        lte(schema.orders.blockTimestamp, "2026-07-25T23:59:59.999Z")
      )
    );

  console.log(`📋 Total de órdenes encontradas en esos 3 días: ${orders.length}\n`);

  if (orders.length === 0) {
    console.log("No se encontraron órdenes en ese rango de fechas en la DB.");
    return;
  }

  // Agrupar por Usuario
  type UserStats = {
    address: string;
    totalOrders: number;
    buyCount: number;
    sellCount: number;
    completedCount: number;
    cancelledCount: number;
    totalUsdcVolume: number;
    totalFiatVolume: number;
  };

  const userMap = new Map<string, UserStats>();

  for (const o of orders) {
    if (!o.user || o.user === "-") continue;

    const stats = userMap.get(o.user) ?? {
      address: o.user,
      totalOrders: 0,
      buyCount: 0,
      sellCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      totalUsdcVolume: 0,
      totalFiatVolume: 0,
    };

    stats.totalOrders++;
    if (o.status === "completed") stats.completedCount++;
    if (o.status === "cancelled") stats.cancelledCount++;

    if (o.orderType === "BUY") stats.buyCount++;
    if (o.orderType === "SELL") stats.sellCount++;

    if (o.status === "completed") {
      stats.totalUsdcVolume += o.usdc;
      stats.totalFiatVolume += o.fiat;
    }

    userMap.set(o.user, stats);
  }

  const sortedByVolume = [...userMap.values()].sort((a, b) => b.totalUsdcVolume - a.totalUsdcVolume);
  const sortedByTx = [...userMap.values()].sort((a, b) => b.totalOrders - a.totalOrders);

  console.log("========================================================");
  console.log("🏆 TOP 10 USUARIOS POR VOLUMEN USDC (23-25 JULIO):");
  sortedByVolume.slice(0, 10).forEach((u, idx) => {
    console.log(
      ` ${idx + 1}. User: ${u.address}`
    );
    console.log(
      `    Volumen USDC: $${u.totalUsdcVolume.toFixed(2)} | Fiat: ${u.totalFiatVolume.toFixed(2)} VES | Órdenes: ${u.totalOrders} (Completadas: ${u.completedCount}, Canceladas: ${u.cancelledCount}) | Compras: ${u.buyCount}, Ventas: ${u.sellCount}`
    );
  });

  console.log("\n========================================================");
  console.log("⚡ TOP 10 USUARIOS POR CANTIDAD DE TRANSACCIONES (23-25 JULIO):");
  sortedByTx.slice(0, 10).forEach((u, idx) => {
    console.log(
      ` ${idx + 1}. User: ${u.address}`
    );
    console.log(
      `    Órdenes: ${u.totalOrders} | Completadas: ${u.completedCount} | Canceladas: ${u.cancelledCount} | Volumen USDC: $${u.totalUsdcVolume.toFixed(2)} | Compras: ${u.buyCount}, Ventas: ${u.sellCount}`
    );
  });
}

main().catch(console.error);
