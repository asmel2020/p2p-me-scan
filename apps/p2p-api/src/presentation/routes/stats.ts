import { Hono } from "hono";
import { count, not, eq, sql } from "drizzle-orm";
import { initDB } from "@p2p-me/db/client";
import { orders } from "@p2p-me/db";

const app = new Hono<{ Bindings: { DB: D1Database } }>();

app.get("/", async (c) => {
  const db = initDB(c.env.DB);

  const [orderCount] = await db
    .select({ total: count() })
    .from(orders);

  const statusCounts = await db
    .select({ status: orders.status, total: count() })
    .from(orders)
    .groupBy(orders.status);

  const currencyTotals = await db
    .select({
      currency: orders.currency,
      totalUsdc: sql<number>`SUM(usdc)`,
      totalFiat: sql<number>`SUM(fiat)`,
      count: count(),
    })
    .from(orders)
    .where(not(eq(orders.status, "cancelled")))
    .groupBy(orders.currency);

  return c.json({
    orders: orderCount.total,
    byStatus: statusCounts,
    byCurrency: currencyTotals,
  });
});

export default app;
