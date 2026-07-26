import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { gte, lte, and } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  console.log(
    "=== BUSCANDO USUARIOS CON MAYOR VOLUMEN Y TRANSACCIONES (23, 24 y 25 de Julio) ===\n",
  );

  const orders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        gte(schema.orders.blockTimestamp, "2026-07-23T00:00:00.000Z"),
        lte(schema.orders.blockTimestamp, "2026-07-25T23:59:59.999Z"),
      ),
    );

  console.log(
    `📋 Total de órdenes encontradas en esos 3 días: ${orders.length}\n`,
  );

  type UserStats = {
    address: string;
    totalOrders: number;
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
      completedCount: 0,
      cancelledCount: 0,
      totalUsdcVolume: 0,
      totalFiatVolume: 0,
    };

    stats.totalOrders++;
    if (o.status === "completed") {
      stats.completedCount++;
      stats.totalUsdcVolume += o.usdc;
      stats.totalFiatVolume += o.fiat;
    }
    if (o.status === "cancelled") stats.cancelledCount++;

    userMap.set(o.user, stats);
  }

  const sortedByVolume = [...userMap.values()].sort(
    (a, b) => b.totalUsdcVolume - a.totalUsdcVolume,
  );

  console.log("🏆 TOP 10 USUARIOS POR VOLUMEN USDC (23-25 JULIO):");
  sortedByVolume.slice(0, 10).forEach((u, idx) => {
    console.log(
      ` ${idx + 1}. User: ${u.address} | Volumen: $${u.totalUsdcVolume.toFixed(2)} USDC | Órdenes: ${u.totalOrders} (Completadas: ${u.completedCount}, Canceladas: ${u.cancelledCount})`,
    );
  });
}

main().catch(console.error);
