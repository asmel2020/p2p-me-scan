import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { desc } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  console.log("=================================================================");
  console.log("📊 HISTORIAL DE OPORTUNIDADES DE ARBITRAJE REGISTRADAS EN D1");
  console.log("=================================================================\n");

  const opps = await db
    .select()
    .from(schema.arbitrageOpportunities)
    .orderBy(desc(schema.arbitrageOpportunities.blockNumber))
    .limit(50);

  console.log(`📋 Total de oportunidades registradas (Últimas 50): ${opps.length}\n`);

  if (opps.length === 0) {
    console.log("Aún no se han guardado oportunidades en la base de datos (se irán guardando en tiempo real en cuanto abran brechas de ganancia).");
    return;
  }

  for (const o of opps) {
    console.log(
      `[${o.blockTimestampIso || o.createdAt}] Bloque ${o.blockNumber} | Ruta: ${o.route} | ` +
      `Contrato [C: ${o.contractBuyPrice.toFixed(2)} | V: ${o.contractSellPrice.toFixed(2)}] | ` +
      `Binance [C: ${o.binanceBuyPrice.toFixed(2)} | V: ${o.binanceSellPrice.toFixed(2)}] | ` +
      `Margen: +${o.marginPct.toFixed(2)}% | Ganancia Proyectada ($250 USDC): +$${o.profitUsdc.toFixed(2)} USDC`
    );
  }
}

main().catch(console.error);
