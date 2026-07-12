import { and, sql, eq, gte, lte } from "drizzle-orm";
import { orders } from "@p2p-me/db";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@p2p-me/db";

type DB = DrizzleD1Database<typeof schema>;

export interface DailyTransferRow {
  date: string;
  currency: string;
  usdcVolume: number;
  fiatVolume: number;
  completedCount: number;
}

export interface GetDailyTransferabilityQuery {
  fromDate?: string;
  toDate?: string;
  currency?: string;
}

export async function getDailyTransferability(
  db: DB,
  query: GetDailyTransferabilityQuery,
): Promise<DailyTransferRow[]> {
  const filters: ReturnType<typeof eq | typeof gte | typeof lte>[] = [];

  if (query.fromDate) {
    filters.push(gte(sql`DATE(${orders.createdAt})`, query.fromDate));
  }
  if (query.toDate) {
    filters.push(lte(sql`DATE(${orders.createdAt})`, query.toDate));
  }
  if (query.currency) {
    filters.push(eq(orders.currency, query.currency));
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  return db
    .select({
      date: sql<string>`DATE(${orders.createdAt})`,
      currency: orders.currency,
      usdcVolume: sql<number>`COALESCE(SUM(${orders.usdc}), 0)`,
      fiatVolume: sql<number>`COALESCE(SUM(${orders.fiat}), 0)`,
      completedCount: sql<number>`COALESCE(SUM(CASE WHEN ${orders.status} = 'completed' THEN 1 ELSE 0 END), 0)`,
    })
    .from(orders)
    .where(where)
    .groupBy(sql`DATE(${orders.createdAt})`, orders.currency)
    .orderBy(sql`DATE(${orders.createdAt})`, orders.currency);
}
