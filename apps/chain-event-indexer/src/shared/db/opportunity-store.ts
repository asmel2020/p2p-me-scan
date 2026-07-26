import type { DB } from "@p2p-me/db/client";
import * as schema from "@p2p-me/db";

export type OpportunityRecord = {
  blockNumber: number;
  route: "LADO_1" | "LADO_2";
  currency: string;
  contractBuyPrice: number;
  contractSellPrice: number;
  binanceBuyPrice: number;
  binanceSellPrice: number;
  spreadGross: number;
  marginPct: number;
  profitUsdc: number;
  blockTimestampIso: string;
};

/**
 * Guarda una oportunidad de arbitraje detectada en la base de datos D1 de forma idempotente.
 */
export async function persistArbitrageOpportunity(
  db: DB,
  opp: OpportunityRecord
) {
  const id = `opp_${opp.blockNumber}_${opp.route}`;

  await db
    .insert(schema.arbitrageOpportunities)
    .values({
      id,
      blockNumber: opp.blockNumber,
      route: opp.route,
      currency: opp.currency,
      contractBuyPrice: opp.contractBuyPrice,
      contractSellPrice: opp.contractSellPrice,
      binanceBuyPrice: opp.binanceBuyPrice,
      binanceSellPrice: opp.binanceSellPrice,
      spreadGross: opp.spreadGross,
      marginPct: opp.marginPct,
      profitUsdc: opp.profitUsdc,
      blockTimestampIso: opp.blockTimestampIso,
    })
    .onConflictDoNothing({
      target: [schema.arbitrageOpportunities.blockNumber, schema.arbitrageOpportunities.route],
    });
}
