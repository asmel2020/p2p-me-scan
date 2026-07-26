import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { createClient, RPC_URLS } from "../../shared/rpc-config";
import { gte, lte, and } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);
const publicClient = createClient(RPC_URLS[0]);

async function main() {
  console.log("=== ANÁLISIS DE ARBITRAJE DE DOS LADOS (BUY & SELL) — 23, 24 Y 25 DE JULIO ===\n");

  const orders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        gte(schema.orders.blockTimestamp, "2026-07-23T00:00:00.000Z"),
        lte(schema.orders.blockTimestamp, "2026-07-25T23:59:59.999Z")
      )
    );

  const buyOrders = orders.filter((o) => o.orderType === "BUY" && o.status === "completed");
  const sellOrders = orders.filter((o) => o.orderType === "SELL" && o.status === "completed");

  console.log(`📊 Total órdenes en los 3 días: ${orders.length}`);
  console.log(`🟢 Órdenes de COMPRA (BUY) completadas: ${buyOrders.length}`);
  console.log(`🔴 Órdenes de VENTA (SELL) completadas: ${sellOrders.length}\n`);

  const sellUserMap = new Map<string, { totalUsdc: number; count: number; sampleOrder: any }>();

  for (const s of sellOrders) {
    if (!s.user || s.user === "-") continue;
    const existing = sellUserMap.get(s.user) ?? { totalUsdc: 0, count: 0, sampleOrder: s };
    existing.totalUsdc += s.usdc;
    existing.count++;
    sellUserMap.set(s.user, existing);
  }

  const topSellers = [...sellUserMap.values()].sort((a, b) => b.totalUsdc - a.totalUsdc);

  console.log(`🏆 Top Vendedores de USDC en el Contrato (23-25 Julio):\n`);
  topSellers.slice(0, 5).forEach((st, idx) => {
    const rate = st.sampleOrder.usdc > 0 ? (st.sampleOrder.fiat / st.sampleOrder.usdc).toFixed(2) : "0";
    console.log(
      ` ${idx + 1}. Seller: ${st.sampleOrder.user} | Total Vendido: $${st.totalUsdc.toFixed(2)} USDC | Órdenes: ${st.count}`
    );
  });
}

main().catch(console.error);
