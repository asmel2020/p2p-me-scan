import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { desc } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  console.log("=================================================================");
  console.log("📊 SIMULACIÓN Y ANÁLISIS DE OPORTUNIDADES REGISTRADAS EN D1");
  console.log("=================================================================\n");

  const opps = await db
    .select()
    .from(schema.arbitrageOpportunities)
    .orderBy(desc(schema.arbitrageOpportunities.blockNumber))
    .limit(50);

  if (opps.length === 0) {
    console.log("ℹ️ Aún no hay oportunidades registradas en la tabla 'arbitrage_opportunities' de D1.");
    console.log("   Con el indexador en marcha, las brechas >1.0% se guardarán aquí automáticamente.");
    return;
  }

  console.log(`📋 Se encontraron ${opps.length} registros de oportunidades para análisis:\n`);

  let profitLado1Total = 0;
  let profitLado2Total = 0;
  let countLado1 = 0;
  let countLado2 = 0;

  opps.forEach((o, idx) => {
    if (o.route === "LADO_1") {
      countLado1++;
      profitLado1Total += o.profitUsdc;
    } else {
      countLado2++;
      profitLado2Total += o.profitUsdc;
    }

    console.log(
      ` #${(idx + 1).toString().padStart(2, " ")} | Bloque: ${o.blockNumber} | Ruta: ${o.route} | Margen: +${o.marginPct.toFixed(2)}%\n` +
      `     └─ Ganancia Proyectada ($250 USDC): +$${o.profitUsdc.toFixed(2)} USDC\n` +
      `     └─ Fecha/Hora: ${o.blockTimestampIso}\n`
    );
  });

  const grandTotalProfit = profitLado1Total + profitLado2Total;

  console.log("=================================================================");
  console.log("💡 RESUMEN DE LA SIMULACIÓN RETROSPECTIVA:");
  console.log(` 🟢 Oportunidades Lado 1 (Contrato -> Binance): ${countLado1} | Ganancia Potencial: +$${profitLado1Total.toFixed(2)} USDC`);
  console.log(` 🔴 Oportunidades Lado 2 (Binance -> Contrato): ${countLado2} | Ganancia Potencial: +$${profitLado2Total.toFixed(2)} USDC`);
  console.log(` 💵 GANANCIA POTENCIAL ACUMULADA SIMULADA: +$${grandTotalProfit.toFixed(2)} USDC`);
  console.log("=================================================================");
}

main().catch(console.error);
