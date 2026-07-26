import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { like, and, eq } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  const todayOrders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        like(schema.orders.blockTimestamp, "2026-07-26%"),
        eq(schema.orders.currency, "VEN")
      )
    );

  console.log(`Total hoy: ${todayOrders.length}`);

  const byStatusAndType: Record<string, number> = {};
  for (const o of todayOrders) {
    const key = `${o.orderType} | status=${o.status}`;
    byStatusAndType[key] = (byStatusAndType[key] || 0) + 1;
  }

  console.log("Desglose exacto por tipo y estado:");
  console.log(byStatusAndType);
}

main().catch(console.error);
