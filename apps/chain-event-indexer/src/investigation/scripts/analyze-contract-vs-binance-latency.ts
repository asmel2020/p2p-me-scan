import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { like, asc } from "drizzle-orm";
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
  console.log("🕵️ ANÁLISIS DE LATENCIA DE ORÁCULO Y DURACIÓN DE BRECHAS (HOY 26 JUL)");
  console.log("   - Investigando si el Contrato tardó en actualizar su tasa");
  console.log("   - Midiendo la duración exacta de cada episodio y su causa raíz");
  console.log("=================================================================\n");

  const todayDatePrefix = "2026-07-26";

  // 1. Obtener oportunidades registradas hoy
  const opps = await db
    .select()
    .from(schema.arbitrageOpportunities)
    .where(like(schema.arbitrageOpportunities.blockTimestampIso, `${todayDatePrefix}%`))
    .orderBy(asc(schema.arbitrageOpportunities.blockNumber));

  // 2. Obtener historial de precios por bloque de hoy
  const blockPrices = await db
    .select()
    .from(schema.blockPrices)
    .where(like(schema.blockPrices.blockTimestamp, `${todayDatePrefix}%`))
    .orderBy(asc(schema.blockPrices.blockNumber));

  const bpMap = new Map<number, typeof blockPrices[0]>();
  blockPrices.forEach((bp) => bpMap.set(bp.blockNumber, bp));

  // 3. Obtener órdenes ejecutadas hoy
  const orders = await db
    .select()
    .from(schema.orders)
    .where(like(schema.orders.blockTimestamp, `${todayDatePrefix}%`))
    .orderBy(asc(schema.orders.updatedBlock));

  if (opps.length === 0) {
    console.log(" ℹ️ No hay oportunidades registradas hoy para este análisis.");
    return;
  }

  // Agrupar en Episodios Individuales de Brechas
  type GapEpisodeDetail = {
    id: number;
    route: string;
    startBlock: number;
    endBlock: number;
    startTimeIso: string;
    endTimeIso: string;
    durationSecs: number;
    durationMins: number;
    initialMarginPct: number;
    peakMarginPct: number;
    contractStartBuy: number;
    contractEndBuy: number;
    binanceStartSell: number;
    binanceEndSell: number;
    contractRateChanged: boolean;
    ordersExecutedDuringGap: number;
    cause: string;
  };

  const episodes: GapEpisodeDetail[] = [];
  let cur: GapEpisodeDetail | null = null;

  for (const o of opps) {
    const bn = o.blockNumber;
    const bp = bpMap.get(bn);

    const contractBuy = bp ? bp.buyPrice : 0;
    const binanceSell = bp ? bp.binanceSellPrice : 0;

    if (cur && cur.route === o.route && bn <= cur.endBlock + 3) {
      cur.endBlock = bn;
      cur.endTimeIso = o.blockTimestampIso;
      cur.durationSecs = (cur.endBlock - cur.startBlock + 1) * 2;
      cur.durationMins = parseFloat((cur.durationSecs / 60).toFixed(1));
      if (o.marginPct > cur.peakMarginPct) cur.peakMarginPct = o.marginPct;
      if (contractBuy > 0) cur.contractEndBuy = contractBuy;
      if (binanceSell > 0) cur.binanceEndSell = binanceSell;
    } else {
      if (cur) {
        // Determinar si la tasa del contrato cambió durante la brecha
        cur.contractRateChanged = cur.contractStartBuy !== cur.contractEndBuy && cur.contractEndBuy > 0;
        // Contar órdenes ejecutadas en este rango de bloques
        cur.ordersExecutedDuringGap = orders.filter(
          (ord) => ord.updatedBlock >= cur!.startBlock && ord.updatedBlock <= cur!.endBlock
        ).length;

        // Determinar causa raíz
        if (!cur.contractRateChanged) {
          cur.cause = `⚠️ CONTRATO ESTÁTICO/RETARDADO (${cur.durationMins} min sin actualizar tasa del contrato)`;
        } else {
          cur.cause = `⚡ MOVIMIENTO DINÁMICO DE BINANCE P2P`;
        }

        episodes.push(cur);
      }

      cur = {
        id: episodes.length + 1,
        route: o.route,
        startBlock: bn,
        endBlock: bn,
        startTimeIso: o.blockTimestampIso,
        endTimeIso: o.blockTimestampIso,
        durationSecs: 2,
        durationMins: 0.0,
        initialMarginPct: o.marginPct,
        peakMarginPct: o.marginPct,
        contractStartBuy: contractBuy,
        contractEndBuy: contractBuy,
        binanceStartSell: binanceSell,
        binanceEndSell: binanceSell,
        contractRateChanged: false,
        ordersExecutedDuringGap: 0,
        cause: "",
      };
    }
  }

  if (cur) {
    cur.contractRateChanged = cur.contractStartBuy !== cur.contractEndBuy && cur.contractEndBuy > 0;
    cur.ordersExecutedDuringGap = orders.filter(
      (ord) => ord.updatedBlock >= cur!.startBlock && ord.updatedBlock <= cur!.endBlock
    ).length;

    if (!cur.contractRateChanged) {
      cur.cause = `⚠️ CONTRATO ESTÁTICO/RETARDADO (${cur.durationMins} min sin actualizar tasa del contrato)`;
    } else {
      cur.cause = `⚡ MOVIMIENTO DINÁMICO DE BINANCE P2P`;
    }

    episodes.push(cur);
  }

  console.log(`=================================================================`);
  console.log(`🏆 ANÁLISIS DE CAUSA RAÍZ Y LATENCIA EN CADA BRECHA (${episodes.length} Episodios):`);
  console.log(`=================================================================\n`);

  let delayedContractCount = 0;
  let dynamicBinanceCount = 0;

  episodes.forEach((e) => {
    if (!e.contractRateChanged) delayedContractCount++;
    else dynamicBinanceCount++;

    const vetStart = toVetTimeString(e.startTimeIso);
    const vetEnd = toVetTimeString(e.endTimeIso);

    console.log(
      `🔹 EPISODIO #${e.id} [${e.route}]\n` +
      `   ├─ Rango de Horas: ${vetStart} ➔ ${vetEnd} (${e.durationMins} minutos / ${e.durationSecs} seg)\n` +
      `   ├─ Rango de Bloques: Bloque ${e.startBlock} ➔ Bloque ${e.endBlock}\n` +
      `   ├─ Margen: Inicial +${e.initialMarginPct.toFixed(2)}% | Máximo Pico: +${e.peakMarginPct.toFixed(2)}%\n` +
      `   ├─ Órdenes Ejecutadas Durante la Brecha: ${e.ordersExecutedDuringGap} operaciones\n` +
      `   └─ CAUSA RAÍZ: ${e.cause}\n`
    );
  });

  const totalSecs = episodes.reduce((a, b) => a + b.durationSecs, 0);
  const avgSecs = totalSecs / episodes.length;

  console.log("=================================================================");
  console.log("💡 REVELACIÓN DE LATENCIA DEL CONTRATO (ORÁCULO/ACTUALIZADOR):");
  console.log(` ⏱️ Duración Promedio de la Brecha: ${avgSecs.toFixed(1)} segundos (~${(avgSecs / 60).toFixed(1)} minutos)`);
  console.log(` 🔴 Brechas causadas por RETRASO/INERCIA DEL CONTRATO: ${delayedContractCount} de ${episodes.length} (${((delayedContractCount / episodes.length) * 100).toFixed(1)}%)`);
  console.log(` 🟢 Brechas causadas por MOVIMIENTO DE BINANCE P2P: ${dynamicBinanceCount} de ${episodes.length} (${((dynamicBinanceCount / episodes.length) * 100).toFixed(1)}%)`);
  console.log("=================================================================\n");
}

main().catch(console.error);
