import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { sql } from "drizzle-orm";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  console.log("=================================================================");
  console.log("🚀 APLICANDO MIGRACIÓN D1: 0005_add_binance_prices_to_block_prices");
  console.log("=================================================================\n");

  try {
    console.log("1️⃣ Agregando columna 'binance_buy_price' a la tabla 'block_prices'...");
    await db.run(sql`ALTER TABLE block_prices ADD COLUMN binance_buy_price REAL NOT NULL DEFAULT 0;`);
    console.log("   └─ Columna binance_buy_price agregada exitosamente.");
  } catch (err: any) {
    console.log(`   └─ Nota: ${err?.message ?? err}`);
  }

  try {
    console.log("2️⃣ Agregando columna 'binance_sell_price' a la tabla 'block_prices'...");
    await db.run(sql`ALTER TABLE block_prices ADD COLUMN binance_sell_price REAL NOT NULL DEFAULT 0;`);
    console.log("   └─ Columna binance_sell_price agregada exitosamente.");
  } catch (err: any) {
    console.log(`   └─ Nota: ${err?.message ?? err}`);
  }

  console.log("\n✅ Migración D1 completada con éxito!");
}

main().catch(console.error);
