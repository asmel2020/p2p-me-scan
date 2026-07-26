import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { like, and, eq, asc } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

/**
 * Convierte un ISO Timestamp UTC a string con hora local de Venezuela (VET = UTC-4).
 */
function toVetTimeString(isoStr: string): string {
  if (!isoStr) return "-";
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return isoStr;

  const vetDate = new Date(date.getTime() - 4 * 60 * 60 * 1000);
  const hours = vetDate.getUTCHours().toString().padStart(2, "0");
  const minutes = vetDate.getUTCMinutes().toString().padStart(2, "0");
  const seconds = vetDate.getUTCSeconds().toString().padStart(2, "0");

  return `${hours}:${minutes}:${seconds} VET`;
}

async function main() {
  console.log("=================================================================");
  console.log("🇻🇪 ANÁLISIS EXCLUSIVO MONEDA VENEZUELA (VEN / VES) — HOY 26 DE JULIO DE 2026");
  console.log("   - Moneda Filtrada Estrictamente: VEN / VES (Bolívares Venezolanos)");
  console.log("   - Zona Horaria: Hora Local de Venezuela (VET - UTC-4)");
  console.log("   - Agrupación: Lado 1 (BUY) y Lado 2 (SELL + RENT juntas)");
  console.log("=================================================================\n");

  const todayDatePrefix = "2026-07-26";

  // -------------------------------------------------------------------------
  // 1. ÓRDENES EN MONEDA VEN DEL DÍA DE HOY
  // -------------------------------------------------------------------------
  console.log("🔍 1. ANÁLISIS DE LAS 62 ÓRDENES VEN DE HOY (LADO 1 VS LADO 2):");

  const todayOrders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        like(schema.orders.blockTimestamp, `${todayDatePrefix}%`),
        eq(schema.orders.currency, "VEN")
      )
    );

  if (todayOrders.length > 0) {
    const totalUsdc = todayOrders.reduce((sum, o) => sum + o.usdc, 0);

    // LADO 1: Compras en Contrato (BUY)
    const buyOrders = todayOrders.filter((o) => o.orderType === "BUY");
    // LADO 2: Ventas y Depósitos Colaterales en Contrato (SELL + RENT JUNTAS)
    const sellRentOrders = todayOrders.filter((o) => o.orderType === "SELL" || o.orderType === "RENT");

    const buyCompleted = buyOrders.filter((o) => o.status === "completed");
    const buyCancelled = buyOrders.filter((o) => o.status === "cancelled");

    const sellRentCompleted = sellRentOrders.filter((o) => o.status === "completed");
    const sellRentCancelled = sellRentOrders.filter((o) => o.status === "cancelled");

    const buyUsdc = buyOrders.reduce((sum, o) => sum + o.usdc, 0);
    const sellRentUsdc = sellRentOrders.reduce((sum, o) => sum + o.usdc, 0);

    console.log(` 📦 TOTAL DE ÓRDENES VEN PROCESADAS HOY: ${todayOrders.length} órdenes`);
    console.log(` 💵 VOLUMEN TOTAL PROCESADO HOY: $${totalUsdc.toFixed(2)} USDC\n`);

    console.log(` 📊 DESGLOSE UNIFICADO POR LADO DE COMERCIO:`);
    console.log(
      ` 🟢 1. LADO 1 (Compras en Contrato - BUY): ${buyOrders.length} órdenes ($${buyUsdc.toFixed(2)} USDC)\n` +
      `      ├─ Completadas: ${buyCompleted.length} ops ($${buyCompleted.reduce((a, b) => a + b.usdc, 0).toFixed(2)} USDC)\n` +
      `      └─ Canceladas:  ${buyCancelled.length} ops`
    );
    console.log(
      ` 🔴 2. LADO 2 (Ventas + Renta/Colateral en Contrato - SELL + RENT): ${sellRentOrders.length} órdenes ($${sellRentUsdc.toFixed(2)} USDC)\n` +
      `      ├─ Completadas: ${sellRentCompleted.length} ops ($${sellRentCompleted.reduce((a, b) => a + b.usdc, 0).toFixed(2)} USDC)\n` +
      `      └─ Canceladas:  ${sellRentCancelled.length} ops`
    );

    const grandTotalCompleted = buyCompleted.length + sellRentCompleted.length;
    const grandTotalCancelled = buyCancelled.length + sellRentCancelled.length;

    console.log(`\n 📊 RESUMEN GLOBAL DE ESTADOS:`);
    console.log(` ├─ ✅ Total Completadas Exitosas: ${grandTotalCompleted} de ${todayOrders.length} (${((grandTotalCompleted / todayOrders.length) * 100).toFixed(1)}%)`);
    console.log(` └─ ❌ Total Canceladas / Fallidas: ${grandTotalCancelled} de ${todayOrders.length} (${((grandTotalCancelled / todayOrders.length) * 100).toFixed(1)}%)\n`);

    // Top Billeteras (BUY + SELL + RENT)
    const walletMap = new Map<string, { address: string; buyUsdc: number; sellUsdc: number; count: number }>();
    for (const o of [...buyCompleted, ...sellRentCompleted]) {
      if (!o.user || o.user === "-") continue;
      const user = o.user.toLowerCase();
      const stats = walletMap.get(user) ?? { address: user, buyUsdc: 0, sellUsdc: 0, count: 0 };
      stats.count++;
      if (o.orderType === "BUY") stats.buyUsdc += o.usdc;
      else stats.sellUsdc += o.usdc;
      walletMap.set(user, stats);
    }

    const topWalletsToday = [...walletMap.values()]
      .sort((a, b) => (b.buyUsdc + b.sellUsdc) - (a.buyUsdc + a.sellUsdc))
      .slice(0, 5);

    console.log(` 🏆 TOP 5 BILLETERAS MÁS ACTIVAS EN VENEZUELA (VEN) HOY:`);
    topWalletsToday.forEach((w, i) => {
      const vol = w.buyUsdc + w.sellUsdc;
      console.log(
        `  #${i + 1} | Wallet: ${w.address}\n` +
        `      └─ Vol Total VEN Hoy: $${vol.toFixed(2)} USDC (${w.count} ops) [Lado 1 (Compras): $${w.buyUsdc.toFixed(2)} | Lado 2 (Ventas+RENT): $${w.sellUsdc.toFixed(2)}]`
      );
    });

    // Horas en VET
    const hourlyMap = new Map<number, { count: number; usdc: number }>();
    for (const o of todayOrders) {
      const date = new Date(o.blockTimestamp || o.createdAt);
      const vetHour = (date.getUTCHours() - 4 + 24) % 24;
      const stats = hourlyMap.get(vetHour) ?? { count: 0, usdc: 0 };
      stats.count++;
      stats.usdc += o.usdc;
      hourlyMap.set(vetHour, stats);
    }

    console.log(`\n 🕒 OPERACIONES EN VENEZUELA (VEN) POR HORA HOY (HORA VENEZUELA VET):`);
    const sortedHours = [...hourlyMap.entries()].sort((a, b) => a[0] - b[0]);
    sortedHours.forEach(([vetHour, stats]) => {
      const hStr = `${vetHour.toString().padStart(2, "0")}:00 VET`;
      const bar = "█".repeat(Math.min(30, Math.ceil(stats.count / 2)));
      console.log(`  ${hStr.padEnd(15, " ")} | ${bar} ${stats.count} ops ($${stats.usdc.toFixed(2)} USDC)`);
    });
  }

  // -------------------------------------------------------------------------
  // 2. OPORTUNIDADES EN VENEZUELA (VEN / VES) REGISTRADAS HOY
  // -------------------------------------------------------------------------
  console.log("\n-----------------------------------------------------------------");
  console.log("🎯 2. OPORTUNIDADES Y BRECHAS EN VENEZUELA (VEN) HOY (D1):");
  console.log("-----------------------------------------------------------------");

  const todayOpps = await db
    .select()
    .from(schema.arbitrageOpportunities)
    .where(like(schema.arbitrageOpportunities.blockTimestampIso, `${todayDatePrefix}%`))
    .orderBy(asc(schema.arbitrageOpportunities.blockNumber));

  if (todayOpps.length > 0) {
    const oppsL1 = todayOpps.filter((o) => o.route === "LADO_1");
    const oppsL2 = todayOpps.filter((o) => o.route === "LADO_2");

    const profitL1 = oppsL1.reduce((a, b) => a + b.profitUsdc, 0);
    const profitL2 = oppsL2.reduce((a, b) => a + b.profitUsdc, 0);
    const margins = todayOpps.map((o) => o.marginPct);

    const minMargin = Math.min(...margins);
    const maxMargin = Math.max(...margins);
    const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;

    console.log(` 📦 Bloques con Oportunidad VEN Guardados Hoy: ${todayOpps.length}`);
    console.log(` 🟢 Oportunidades Lado 1 (Contrato -> Binance): ${oppsL1.length} bloques ($${profitL1.toFixed(2)} USDC ganancia)`);
    console.log(` 🔴 Oportunidades Lado 2 (Binance -> Contrato): ${oppsL2.length} bloques ($${profitL2.toFixed(2)} USDC ganancia)`);
    console.log(` 📈 Margen Mínimo: +${minMargin.toFixed(2)}% | Máximo: +${maxMargin.toFixed(2)}% | Promedio: +${avgMargin.toFixed(2)}%`);
    console.log(` 💵 Ganancia Acumulada Potencial Simulada Hoy en VEN: +$${(profitL1 + profitL2).toFixed(2)} USDC\n`);

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

    console.log(` 🏆 EPISODIOS INDIVIDUALES EN VENEZUELA (VEN) HOY (${episodes.length} Episodios):`);
    episodes.forEach((e) => {
      const growthStr = e.peakMargin > e.initialMargin
        ? `🔥 CRECIÓ (+${e.initialMargin.toFixed(2)}% ➔ +${e.peakMargin.toFixed(2)}%)`
        : `Estable (+${e.initialMargin.toFixed(2)}%)`;

      const vetTimeStr = toVetTimeString(e.startTime);

      console.log(
        `  Episodio #${e.id} [${e.route}] | Bloques: ${e.startBlock} ➔ ${e.endBlock} | Duración: ${e.durationSecs} seg (~${(e.durationSecs / 60).toFixed(1)} min)\n` +
        `      └─ Hora Inicio: ${vetTimeStr} | Margen: ${growthStr}`
      );
    });
  }

  console.log("=================================================================\n");
}

main().catch(console.error);
