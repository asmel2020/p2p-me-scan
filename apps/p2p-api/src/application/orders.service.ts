import { eq, desc, and, lt, gte, lte, sql } from "drizzle-orm";
import { orders, orderEvents } from "@p2p-me/db";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { SQL } from "drizzle-orm";
import * as schema from "@p2p-me/db";

type DB = DrizzleD1Database<typeof schema>;

export interface GetOrdersQuery {
  cursorOrderId?: number;
  limit: number;
  status?: string;
  currency?: string;
  orderType?: string;
  fromDate?: string;
  toDate?: string;
}

export async function getOrders(db: DB, query: GetOrdersQuery) {
  const filters: SQL[] = [];

  if (query.status) filters.push(eq(orders.status, query.status));
  if (query.currency) filters.push(eq(orders.currency, query.currency));
  if (query.orderType) filters.push(eq(orders.orderType, query.orderType));

  if (query.cursorOrderId) {
    filters.push(lt(orders.orderId, query.cursorOrderId));
  }

  if (query.fromDate) {
    filters.push(gte(sql`DATE(block_timestamp)`, query.fromDate));
  }
  if (query.toDate) {
    filters.push(lte(sql`DATE(block_timestamp)`, query.toDate));
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  const items = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.orderId))
    .limit(query.limit);

  return {
    items,
    nextCursorOrderId: items.length === query.limit
      ? items[items.length - 1].orderId
      : null,
  };
}

export async function getOrder(db: DB, orderId: number) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderId, orderId))
    .limit(1);

  return order ?? null;
}

export async function getOrderEvents(db: DB, orderId: number) {
  return db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(desc(orderEvents.blockNumber), desc(orderEvents.logIndex))
    .limit(5);
}
