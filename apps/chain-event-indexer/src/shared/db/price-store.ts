import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@p2p-me/db";
import { v4 as uuidv4 } from "uuid";
import type { BlockPriceResult } from "../price";

/**
 * Persiste un precio de bloque en D1.
 * Usa ON CONFLICT DO NOTHING para ser idempotente — si el bloque+currency
 * ya existe, no hace nada.
 */
export async function persistBlockPrice(
  db: DrizzleD1Database<typeof schema>,
  blockNumber: number,
  price: BlockPriceResult,
  blockTimestamp: string,
  blockTimestampUnix: number,
): Promise<void> {
  await db
    .insert(schema.blockPrices)
    .values({
      id: uuidv4(),
      blockNumber,
      currency: price.currency,
      currencyHex: price.currencyHex,
      buyPrice: price.buyPrice,
      sellPrice: price.sellPrice,
      buyPriceOffset: price.buyPriceOffset,
      baseSpread: price.baseSpread,
      blockTimestamp,
      blockTimestampUnix,
    })
    .onConflictDoNothing();
}

/**
 * Persiste múltiples precios de bloque (uno por moneda) para un bloque dado.
 */
export async function persistBlockPrices(
  db: DrizzleD1Database<typeof schema>,
  blockNumber: number,
  prices: BlockPriceResult[],
  blockTimestamp: string,
  blockTimestampUnix: number,
): Promise<void> {
  for (const price of prices) {
    await persistBlockPrice(db, blockNumber, price, blockTimestamp, blockTimestampUnix);
  }
}
