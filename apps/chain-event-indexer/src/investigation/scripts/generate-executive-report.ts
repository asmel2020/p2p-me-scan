import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { like, and, eq, asc, desc } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

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
  console.log("👔 ELABORANDO INFORME EJECUTIVO PARA JUNTA DE ACCIÓN ESTRATÉGICA");
  console.log("   - Análisis cuantitativo de ganancias, estrategias y latencias");
  console.log("   - Moneda: VEN / VES | Fecha: 26 de Julio de 2026");
  console.log("=================================================================\n");

  const todayDatePrefix = "2026-07-26";

  // 1. Obtener todas las órdenes VEN de hoy
  const todayOrders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        like(schema.orders.blockTimestamp, `${todayDatePrefix}%`),
        eq(schema.orders.currency, "VEN")
      )
    )
    .orderBy(asc(schema.orders.updatedBlock));

  // 2. Obtener precios por bloque guardados hoy en D1
  const blockPricesList = await db
    .select()
    .from(schema.blockPrices)
    .where(like(schema.blockPrices.blockTimestamp, `${todayDatePrefix}%`));

  const blockPriceMap = new Map<number, typeof blockPricesList[0]>();
  blockPricesList.forEach((bp) => blockPriceMap.set(bp.blockNumber, bp));

  // 3. Obtener oportunidades registradas hoy
  const oppsList = await db
    .select()
    .from(schema.arbitrageOpportunities)
    .where(like(schema.arbitrageOpportunities.blockTimestampIso, `${todayDatePrefix}%`));

  const oppMap = new Map<number, typeof oppsList[0]>();
  oppsList.forEach((op) => oppMap.set(op.blockNumber, op));

  // Calcular métricas de ganancias por orden y por wallet
  type WalletProfitSummary = {
    address: string;
    totalOrders: number;
    completedOrders: number;
    buyUsdc: number;
    sellUsdc: number;
    totalUsdc: number;
    estProfitUsdc: number;
    estProfitVes: number;
    avgMarginPct: number;
    margins: number[];
  };

  const walletProfits = new Map<string, WalletProfitSummary>();
  let grandTotalProfitUsdc = 0;

  for (const o of todayOrders) {
    if (o.status !== "completed" || !o.user || o.user === "-") continue;
    const user = o.user.toLowerCase();
    const bn = o.updatedBlock;

    // Buscar brecha registrada en este bloque o bloque adyacente (+-5)
    let margin = 0.85; // Margen promedio empírico por defecto (0.85%)
    let binanceSellRate = 0;

    for (let offset = -5; offset <= 5; offset++) {
      const opp = oppMap.get(bn + offset);
      if (opp && opp.marginPct > 0) {
        margin = opp.marginPct;
        break;
      }
    }

    const bp = blockPriceMap.get(bn);
    if (bp && bp.binanceSellPrice > 0 && bp.buyPrice > 0) {
      margin = ((bp.binanceSellPrice - bp.buyPrice) / bp.buyPrice) * 100;
      binanceSellRate = bp.binanceSellPrice;
    }

    const profitUsdc = o.usdc * (margin / 100);
    const profitVes = profitUsdc * (binanceSellRate > 0 ? binanceSellRate : 860.0);

    grandTotalProfitUsdc += profitUsdc;

    const stats = walletProfits.get(user) ?? {
      address: user,
      totalOrders: 0,
      completedOrders: 0,
      buyUsdc: 0,
      sellUsdc: 0,
      totalUsdc: 0,
      estProfitUsdc: 0,
      estProfitVes: 0,
      avgMarginPct: 0,
      margins: [],
    };

    stats.totalOrders++;
    stats.completedOrders++;
    if (o.orderType === "BUY") stats.buyUsdc += o.usdc;
    else stats.sellUsdc += o.usdc;
    stats.totalUsdc += o.usdc;
    stats.estProfitUsdc += profitUsdc;
    stats.estProfitVes += profitVes;
    stats.margins.push(margin);
    stats.avgMarginPct = stats.margins.reduce((a, b) => a + b, 0) / stats.margins.length;

    walletProfits.set(user, stats);
  }

  const sortedWallets = [...walletProfits.values()].sort((a, b) => b.estProfitUsdc - a.estProfitUsdc);

  // Análisis de estrategias de margen de compra
  const marginRanges = {
    bajo: { count: 0, usdc: 0, label: "0.01% a 0.50% (Bajo riesgo / Micro-márgenes)" },
    medio: { count: 0, usdc: 0, label: "0.51% a 1.20% (Estándar competitivo)" },
    alto: { count: 0, usdc: 0, label: "1.21% a 2.50% (Expansión de brecha)" },
    extremo: { count: 0, usdc: 0, label: "> 2.50% (Picos de alta volatilidad)" },
  };

  for (const w of sortedWallets) {
    w.margins.forEach((m) => {
      if (m <= 0.5) marginRanges.bajo.count++;
      else if (m <= 1.2) marginRanges.medio.count++;
      else if (m <= 2.5) marginRanges.alto.count++;
      else marginRanges.extremo.count++;
    });
  }

  console.log(`=================================================================`);
  console.log(`🏆 RESUMEN DE GANANCIAS ESTIMADAS DE LOS OPERADORES HOY:`);
  console.log(`=================================================================\n`);
  console.log(` 💵 Ganancia Neta Total Extraída Hoy por Operadores: +$${grandTotalProfitUsdc.toFixed(2)} USDC`);
  console.log(` 📊 Total Órdenes VEN Evaluadas: ${todayOrders.length}\n`);

  sortedWallets.forEach((w, i) => {
    console.log(
      ` 🥇 OPERADOR #${i + 1}: ${w.address}\n` +
      `    ├─ Ganancia Neta Hoy: +$${w.estProfitUsdc.toFixed(2)} USDC (~${(w.estProfitUsdc * 860).toFixed(0)} VES)\n` +
      `    ├─ Volumen Movido: $${w.totalUsdc.toFixed(2)} USDC (${w.completedOrders} ops completadas)\n` +
      `    ├─ Margen Promedio Capturado: +${w.avgMarginPct.toFixed(2)}%\n` +
      `    └─ Estrategia: ${w.avgMarginPct > 1.0 ? "🎯 Cazador de Picos de Expansión" : "⚡ Ejecución Ultra-Rápida a Bajo Margen"}\n`
    );
  });

  console.log("=================================================================");
  console.log("📊 DISTRIBUCIÓN DE ESTRATEGIAS SEGÚN MARGEN ENTRADA:");
  console.log(` 🔹 ${marginRanges.bajo.label}: ${marginRanges.bajo.count} ejecuciones`);
  console.log(` 🔹 ${marginRanges.medio.label}: ${marginRanges.medio.count} ejecuciones`);
  console.log(` 🔹 ${marginRanges.alto.label}: ${marginRanges.alto.count} ejecuciones`);
  console.log(` 🔹 ${marginRanges.extremo.label}: ${marginRanges.extremo.count} ejecuciones`);
  console.log("=================================================================\n");
}

main().catch(console.error);
