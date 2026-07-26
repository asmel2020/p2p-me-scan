import { initRemoteDB } from "@p2p-me/db/client";
import { getCloudflareEnv } from "../../shared/env";
import { sql } from "drizzle-orm";
import * as schema from "@p2p-me/db";

const { accountId, databaseId, apiToken } = getCloudflareEnv();
const db = initRemoteDB(accountId, databaseId, apiToken);

async function main() {
  const result = await db
    .select({
      currency: schema.orders.currency,
      count: sql<number>`count(*)`,
    })
    .from(schema.orders)
    .groupBy(schema.orders.currency);

  console.log("================================================ Memory breakdown:");
  console.log(result);
}

main().catch(console.error);
