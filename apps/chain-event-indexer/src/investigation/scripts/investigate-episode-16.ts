import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { and, gte, lte, asc } from "drizzle-orm";
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
  console.log("🔬 AUTOPSIA FORENSE BLOCK-BY-BLOCK: EPISODIO #16 (08:44 ➔ 08:56 VET)");
  console.log("=================================================================\n");

  const startBlock = 49140276;
  const endBlock = 49140630;

  // 1. Obtener precios por bloque desde 10 bloques antes hasta 10 bloques después
  const prices = await db
    .select()
    .from(schema.blockPrices)
    .where(
      and(
        gte(schema.blockPrices.blockNumber, startBlock - 10),
        lte(schema.blockPrices.blockNumber, endBlock + 10)
      )
    )
    .orderBy(asc(schema.blockPrices.blockNumber));

  // 2. Obtener órdenes en ese rango de bloques
  const orders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        gte(schema.orders.updatedBlock, startBlock - 10),
        lte(schema.orders.updatedBlock, endBlock + 10)
      )
    )
    .orderBy(asc(schema.orders.updatedBlock));

  console.log(`📋 Se analizaron ${prices.length} bloques y ${orders.length} órdenes en la ventana de Episodio #16.\n`);

  // Precios al inicio, durante y al final
  const beforeBp = prices.find((p) => p.blockNumber === startBlock - 1);
  const startBp = prices.find((p) => p.blockNumber === startBlock);
  const midBp = prices.find((p) => p.blockNumber === Math.floor((startBlock + endBlock) / 2));
  const endBp = prices.find((p) => p.blockNumber === endBlock);
  const afterBp = prices.find((p) => p.blockNumber === endBlock + 1);

  console.log("-----------------------------------------------------------------");
  console.log("📌 1. EVOLUCIÓN DE TASAS (CONTRATO VS BINANCE P2P):");
  console.log("-----------------------------------------------------------------");
  if (startBp) {
    console.log(` 🟢 INICIO DE BRECHA (Bloque ${startBp.blockNumber} — ${toVetTimeString(startBp.blockTimestamp || startBp.createdAt)}):`);
    console.log(`    ├─ Tasa Compra Contrato: ${startBp.buyPrice} VES`);
    console.log(`    ├─ Tasa Venta Binance P2P: ${startBp.binanceSellPrice} VES`);
    console.log(`    └─ Margen en Inicio: +${(((startBp.binanceSellPrice - startBp.buyPrice) / startBp.buyPrice) * 100).toFixed(2)}%\n`);
  }

  if (endBp) {
    console.log(` 🔴 FIN DE BRECHA (Bloque ${endBp.blockNumber} — ${toVetTimeString(endBp.blockTimestamp || endBp.createdAt)}):`);
    console.log(`    ├─ Tasa Compra Contrato: ${endBp.buyPrice} VES`);
    console.log(`    ├─ Tasa Venta Binance P2P: ${endBp.binanceSellPrice} VES`);
    console.log(`    └─ Margen al Cierre: +${(((endBp.binanceSellPrice - endBp.buyPrice) / endBp.buyPrice) * 100).toFixed(2)}%\n`);
  }

  if (afterBp) {
    console.log(` ⚡ BLOQUE INMEDIATAMENTE POST-CIERRE (Bloque ${afterBp.blockNumber} — ${toVetTimeString(afterBp.blockTimestamp || afterBp.createdAt)}):`);
    console.log(`    ├─ Tasa Compra Contrato: ${afterBp.buyPrice} VES`);
    console.log(`    ├─ Tasa Venta Binance P2P: ${afterBp.binanceSellPrice} VES`);
    console.log(`    └─ Cambio en Contrato: ${afterBp.buyPrice !== endBp?.buyPrice ? `SI (${endBp?.buyPrice} ➔ ${afterBp.buyPrice})` : "NO (Permanece igual)"}`);
    console.log(`    └─ Cambio en Binance P2P: ${afterBp.binanceSellPrice !== endBp?.binanceSellPrice ? `SI (${endBp?.binanceSellPrice} ➔ ${afterBp.binanceSellPrice})` : "NO (Permanece igual)"}\n`);
  }

  console.log("-----------------------------------------------------------------");
  console.log("📦 2. DETALLE DE ÓRDENES EJECUTADAS EN EL EPISODIO #16:");
  console.log("-----------------------------------------------------------------");

  if (orders.length === 0) {
    console.log(" ℹ️ No se registraron ejecuciones de órdenes directas en este bloque.");
  } else {
    orders.forEach((o, i) => {
      console.log(
        ` #${(i + 1).toString().padStart(2, " ")} | Bloque: ${o.updatedBlock} (${toVetTimeString(o.blockTimestamp || o.createdAt)})\n` +
        `     ├─ Billetera: ${o.user}\n` +
        `     ├─ Tipo: ${o.orderType} | Estado: ${o.status}\n` +
        `     └─ Monto USDC: $${o.usdc.toFixed(2)} USDC | Tasa Ejecutada: ${o.priceOffset || o.executionPrice || "Tasa Dinámica"} VES`
      );
    });
  }

  console.log("=================================================================\n");
}

main().catch(console.error);
