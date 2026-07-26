import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { gte, lte, and, asc, desc } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  console.log("=================================================================");
  console.log("📊 ANÁLISIS COMPLETO DEL DÍA DE HOY (26 DE JULIO DE 2026)");
  console.log("   - Órdenes Ejecutadas en el Contrato Smart Diamond");
  console.log("   - Oportunidades de Entrada y Brechas de Binance P2P");
  console.log("   - Correlación de Horarios y Billeteras Operadoras");
  console.log("=================================================================\n");

  const todayStart = "2026-07-26T00:00:00.000Z";
  const todayEnd = "2026-07-26T23:59:59.999Z";

  // -------------------------------------------------------------------------
  // 1. ANÁLISIS DE ÓRDENES REALIZADAS HOY EN EL CONTRATO
  // -------------------------------------------------------------------------
  console.log("🔍 1. ANÁLISIS DE ÓRDENES EN EL CONTRATO SMART DIAMOND:");

  const todayOrders = await db
    .select()
    .from(schema.orders)
    .where(and(gte(schema.orders.blockTimestamp, todayStart), lte(schema.orders.blockTimestamp, todayEnd)));

  if (todayOrders.length === 0) {
    console.log(" ℹ️ No hay órdenes registradas aún en el día de hoy (o la fecha del sistema requiere consulta amplia).");
  } else {
    const totalUsdc = todayOrders.reduce((sum, o) => sum + o.usdc, 0);
    const completedOrders = todayOrders.filter((o) => o.status === "completed");
    const cancelledOrders = todayOrders.filter((o) => o.status === "cancelled");
    const placedOrders = todayOrders.filter((o) => o.status === "placed");

    const buyOrders = todayOrders.filter((o) => o.orderType === "BUY");
    const sellOrders = todayOrders.filter((o) => o.orderType === "SELL");

    const buyUsdc = buyOrders.reduce((sum, o) => sum + o.usdc, 0);
    const sellUsdc = sellOrders.reduce((sum, o) => sum + o.usdc, 0);

    console.log(` 📦 Total Órdenes Procesadas Hoy: ${todayOrders.length}`);
    console.log(` 💵 Volumen Total Procesado Hoy: $${totalUsdc.toFixed(2)} USDC`);
    console.log(` ├─ 🟢 Órdenes de Compra (Lado 1): ${buyOrders.length} ops ($${buyUsdc.toFixed(2)} USDC)`);
    console.log(` └─ 🔴 Órdenes de Venta  (Lado 2): ${sellOrders.length} ops ($${sellUsdc.toFixed(2)} USDC)\n`);

    console.log(` 📊 Estado de las Órdenes:`);
    console.log(` ├─ ✅ Completadas: ${completedOrders.length} (${((completedOrders.length / todayOrders.length) * 100).toFixed(1)}%)`);
    console.log(` ├─ ❌ Canceladas: ${cancelledOrders.length} (${((cancelledOrders.length / todayOrders.length) * 100).toFixed(1)}%)`);
    console.log(` └─ ⏳ En Proceso/Abiertas: ${placedOrders.length}\n`);

    // Top Billeteras Operadoras de Hoy
    const walletMap = new Map<string, { address: string; buyUsdc: number; sellUsdc: number; count: number }>();
    for (const o of completedOrders) {
      if (!o.user || o.user === "-") continue;
      const user = o.user.toLowerCase();
      const stats = walletMap.get(user) ?? { address: user, buyUsdc: 0, sellUsdc: 0, count: 0 };
      stats.count++;
      if (o.orderType === "BUY") stats.buyUsdc += o.usdc;
      if (o.orderType === "SELL") stats.sellUsdc += o.usdc;
      walletMap.set(user, stats);
    }

    const topWalletsToday = [...walletMap.values()]
      .sort((a, b) => (b.buyUsdc + b.sellUsdc) - (a.buyUsdc + a.sellUsdc))
      .slice(0, 5);

    console.log(` 🏆 TOP 5 BILLETERAS MÁS ACTIVAS HOY:`);
    topWalletsToday.forEach((w, i) => {
      const vol = w.buyUsdc + w.sellUsdc;
      console.log(
        `  #${i + 1} | Wallet: ${w.address}\n` +
        `      └─ Vol Total: $${vol.toFixed(2)} USDC (${w.count} ops) [Compras: $${w.buyUsdc.toFixed(2)} | Ventas: $${w.sellUsdc.toFixed(2)}]`
      );
    });

    // Distribución por Hora (UTC)
    const hourlyMap = new Map<number, { count: number; usdc: number }>();
    for (const o of todayOrders) {
      const hour = new Date(o.blockTimestamp).getUTCHours();
      const stats = hourlyMap.get(hour) ?? { count: 0, usdc: 0 };
      stats.count++;
      stats.usdc += o.usdc;
      hourlyMap.set(hour, stats);
    }

    console.log(`\n 🕒 DISTRIBUCIÓN DE OPERACIONES POR HORA (HOY UTC):`);
    const sortedHours = [...hourlyMap.entries()].sort((a, b) => a[0] - b[0]);
    sortedHours.forEach(([hour, stats]) => {
      const hStr = `${hour.toString().padStart(2, "0")}:00 UTC (${(hour - 4 + 24) % 24}:00 VET)`;
      const bar = "█".repeat(Math.min(30, Math.ceil(stats.count / 2)));
      console.log(`  ${hStr.padEnd(25, " ")} | ${bar} ${stats.count} ops ($${stats.usdc.toFixed(2)} USDC)`);
    });
  }

  // -------------------------------------------------------------------------
  // 2. ANÁLISIS DE OPORTUNIDADES DE ARBITRAJE REGISTRADAS HOY
  // -------------------------------------------------------------------------
  console.log("\n-----------------------------------------------------------------");
  console.log("🎯 2. ANÁLISIS DE OPORTUNIDADES Y BRECHAS REGISTRADAS HOY (D1):");
  console.log("-----------------------------------------------------------------");

  const todayOpps = await db
    .select()
    .from(schema.arbitrageOpportunities)
    .where(and(gte(schema.arbitrageOpportunities.blockTimestampIso, todayStart), lte(schema.arbitrageOpportunities.blockTimestampIso, todayEnd)))
    .orderBy(asc(schema.arbitrageOpportunities.blockNumber));

  if (todayOpps.length === 0) {
    console.log(" ℹ️ No hay registros de oportunidades guardadas en 'arbitrage_opportunities' para la fecha exacta.");
  } else {
    const oppsL1 = todayOpps.filter((o) => o.route === "LADO_1");
    const oppsL2 = todayOpps.filter((o) => o.route === "LADO_2");

    const profitL1 = oppsL1.reduce((a, b) => a + b.profitUsdc, 0);
    const profitL2 = oppsL2.reduce((a, b) => a + b.profitUsdc, 0);
    const margins = todayOpps.map((o) => o.marginPct);

    const minMargin = Math.min(...margins);
    const maxMargin = Math.max(...margins);
    const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;

    console.log(` 📦 Total Bloques con Oportunidad Detectados Hoy: ${todayOpps.length}`);
    console.log(` 🟢 Oportunidades Lado 1 (Contrato -> Binance): ${oppsL1.length} bloques ($${profitL1.toFixed(2)} USDC ganancia proyectada)`);
    console.log(` 🔴 Oportunidades Lado 2 (Binance -> Contrato): ${oppsL2.length} bloques ($${profitL2.toFixed(2)} USDC ganancia proyectada)`);
    console.log(` 📈 Margen Mínimo: +${minMargin.toFixed(2)}% | Máximo: +${maxMargin.toFixed(2)}% | Promedio: +${avgMargin.toFixed(2)}%`);
    console.log(` 💵 Ganancia Acumulada Potencial Simulado Hoy: +$${(profitL1 + profitL2).toFixed(2)} USDC\n`);

    // Agrupar en episodios consecutivos
    type GapEpisode = {
      id: number;
      route: string;
      startBlock: number;
      endBlock: number;
      durationSecs: number;
      initialMargin: number;
      peakMargin: number;
      startTime: string;
    };

    const episodes: GapEpisode[] = [];
    let cur: GapEpisode | null = null;

    for (const o of todayOpps) {
      if (cur && cur.route === o.route && o.blockNumber <= cur.endBlock + 3) {
        cur.endBlock = o.blockNumber;
        cur.durationSecs = (cur.endBlock - cur.startBlock + 1) * 2;
        if (o.marginPct > cur.peakMargin) cur.peakMargin = o.marginPct;
      } else {
        if (cur) episodes.push(cur);
        cur = {
          id: episodes.length + 1,
          route: o.route,
          startBlock: o.blockNumber,
          endBlock: o.blockNumber,
          durationSecs: 2,
          initialMargin: o.marginPct,
          peakMargin: o.marginPct,
          startTime: o.blockTimestampIso,
        };
      }
    }
    if (cur) episodes.push(cur);

    console.log(` 🏆 EPISODIOS DE BRECHA INDIVIDUALES DE HOY (${episodes.length} Episodios):`);
    episodes.forEach((e) => {
      const growthStr = e.peakMargin > e.initialMargin
        ? `🔥 CRECIÓ (+${e.initialMargin.toFixed(2)}% ➔ +${e.peakMargin.toFixed(2)}%)`
        : `Estable (+${e.initialMargin.toFixed(2)}%)`;

      console.log(
        `  Episodio #${e.id} [${e.route}] | Bloques: ${e.startBlock} ➔ ${e.endBlock} | Duración: ${e.durationSecs} seg (~${(e.durationSecs / 60).toFixed(1)} min)\n` +
        `      └─ Hora Inicio: ${e.startTime} | Margen: ${growthStr}`
      );
    });
  }

  // -------------------------------------------------------------------------
  // 3. ANÁLISIS RECIENTE GENERAL (ÚLTIMAS 24 HORAS)
  // -------------------------------------------------------------------------
  console.log("\n-----------------------------------------------------------------");
  console.log("🌐 3. RESUMEN GLOBAL DE LAS ÚLTIMAS 24 HORAS EN D1:");
  console.log("-----------------------------------------------------------------");

  const last24hStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentOrders = await db
    .select()
    .from(schema.orders)
    .where(gte(schema.orders.blockTimestamp, last24hStart));

  const recentCompleted = recentOrders.filter((o) => o.status === "completed");
  const totalRecentUsdc = recentCompleted.reduce((a, b) => a + b.usdc, 0);

  console.log(` 📦 Órdenes Completadas en las Últimas 24 Horas: ${recentCompleted.length}`);
  console.log(` 💵 Volumen USDC Comercializado en las Últimas 24h: $${totalRecentUsdc.toFixed(2)} USDC`);
  console.log("=================================================================\n");
}

main().catch(console.error);
