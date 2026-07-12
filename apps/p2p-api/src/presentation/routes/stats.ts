import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { count, not, eq, gte, lte, and, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { initDB } from "@p2p-me/db/client";
import { orders } from "@p2p-me/db";

const app = new Hono<{ Bindings: { DB: D1Database } }>();

const statsQuerySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  currency: z.string().max(10).optional(),
});

app.get("/", zValidator("query", statsQuerySchema), async (c) => {
  const db = initDB(c.env.DB);
  const { fromDate, toDate, currency } = c.req.valid("query");

  const filters: SQL[] = [];

  if (fromDate) filters.push(gte(sql`DATE(block_timestamp)`, fromDate));
  if (toDate) filters.push(lte(sql`DATE(block_timestamp)`, toDate));
  if (currency) filters.push(eq(orders.currency, currency));

  const where = filters.length > 0 ? and(...filters) : undefined;

  const [orderCount] = await db
    .select({ total: count() })
    .from(orders)
    .where(where);

  const statusCounts = await db
    .select({ status: orders.status, total: count() })
    .from(orders)
    .where(where)
    .groupBy(orders.status);

  const currencyFilters: SQL[] = [...filters, not(eq(orders.status, "cancelled"))];
  const currencyWhere = currencyFilters.length > 0 ? and(...currencyFilters) : undefined;

  const currencyTotals = await db
    .select({
      currency: orders.currency,
      totalUsdc: sql<number>`SUM(usdc)`,
      totalFiat: sql<number>`SUM(fiat)`,
      count: count(),
    })
    .from(orders)
    .where(currencyWhere)
    .groupBy(orders.currency);

  return c.json({
    orders: orderCount.total,
    byStatus: statusCounts,
    byCurrency: currencyTotals,
  });
});

export default app;
