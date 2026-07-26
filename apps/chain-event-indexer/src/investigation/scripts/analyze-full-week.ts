import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { gte, lte, and } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  console.log("=================================================================");
  console.log("📊 ANÁLISIS DE LOS ÚLTIMOS 7 DÍAS (19 - 26 DE JULIO 2026)");
  console.log("=================================================================\n");

  const fromDate = "2026-07-19T00:00:00.000Z";
  const toDate = "2026-07-26T23:59:59.999Z";

  const orders = await db
    .select()
    .from(schema.orders)
    .where(and(gte(schema.orders.blockTimestamp, fromDate), lte(schema.orders.blockTimestamp, toDate)));

  console.log(`📋 Total de órdenes en los últimos 7 días: ${orders.length}`);

  type WalletStats = {
    address: string;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    buyCount: number;
    sellCount: number;
    totalBuyUsdc: number;
    totalSellUsdc: number;
    netVolumeUsdc: number;
    avgOrderUsdc: number;
    firstSeen: string;
    lastSeen: string;
  };

  const walletMap = new Map<string, WalletStats>();

  for (const o of orders) {
    const userAddr = o.user;
    if (!userAddr || userAddr === "-") continue;

    const stats = walletMap.get(userAddr) ?? {
      address: userAddr,
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      buyCount: 0,
      sellCount: 0,
      totalBuyUsdc: 0,
      totalSellUsdc: 0,
      netVolumeUsdc: 0,
      avgOrderUsdc: 0,
      firstSeen: o.blockTimestamp ?? "",
      lastSeen: o.blockTimestamp ?? "",
    };

    stats.totalOrders++;

    if (o.blockTimestamp) {
      if (!stats.firstSeen || o.blockTimestamp < stats.firstSeen) stats.firstSeen = o.blockTimestamp;
      if (!stats.lastSeen || o.blockTimestamp > stats.lastSeen) stats.lastSeen = o.blockTimestamp;
    }

    if (o.orderType === "BUY") stats.buyCount++;
    if (o.orderType === "SELL") stats.sellCount++;

    if (o.status === "completed") {
      stats.completedOrders++;
      if (o.orderType === "BUY") stats.totalBuyUsdc += o.usdc;
      if (o.orderType === "SELL") stats.totalSellUsdc += o.usdc;
      stats.netVolumeUsdc += o.usdc;
    }
    if (o.status === "cancelled") stats.cancelledOrders++;

    walletMap.set(userAddr, stats);
  }

  const allWallets = [...walletMap.values()];

  for (const w of allWallets) {
    w.avgOrderUsdc = w.completedOrders > 0 ? w.netVolumeUsdc / w.completedOrders : 0;
  }

  console.log(`👤 Billeteras activas esta semana: ${allWallets.length}\n`);

  const sortedByVolume = [...allWallets].sort((a, b) => b.netVolumeUsdc - a.netVolumeUsdc);

  console.log("🏆 TOP 15 BILLETERAS CON MAYOR VOLUMEN ESTA SEMANA (19-26 JULIO):");
  console.log("---------------------------------------------------------------------------------------------------------");
  sortedByVolume.slice(0, 15).forEach((w, idx) => {
    const cancelRate = ((w.cancelledOrders / w.totalOrders) * 100).toFixed(1);
    console.log(
      ` #${(idx + 1).toString().padStart(2, " ")} | Wallet: ${w.address}\n` +
      `     └─ Vol. Total: $${w.netVolumeUsdc.toFixed(2)} USDC | Compras: $${w.totalBuyUsdc.toFixed(2)} USDC | Ventas: $${w.totalSellUsdc.toFixed(2)} USDC\n` +
      `     └─ Órdenes: ${w.totalOrders} (Completadas: ${w.completedOrders}, Canceladas: ${w.cancelledOrders} [${cancelRate}%]) | Promedio: $${w.avgOrderUsdc.toFixed(2)} USDC`
    );
  });

  const bots = allWallets.filter((w) => w.totalOrders >= 5 && w.cancelledOrders / w.totalOrders > 0.8);
  console.log(`\n🤖 Billeteras con >80% de cancelaciones (Bots Exploradores activos esta semana): ${bots.length}`);
  bots.forEach((b, idx) => {
    console.log(`   ${idx + 1}. ${b.address} | ${b.cancelledOrders}/${b.totalOrders} canceladas | Vol: $${b.netVolumeUsdc.toFixed(2)} USDC`);
  });
}

main().catch(console.error);
