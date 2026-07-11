import { eq, desc, and, lt } from "drizzle-orm";
import { orders, orderEvents } from "@p2p-me/db";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@p2p-me/db";

type DB = DrizzleD1Database<typeof schema>;

export interface GetOrdersQuery {
  cursorOrderId?: string;
  limit: number;
  status?: string;
  currency?: string;
  orderType?: string;
}

export async function getOrders(db: DB, query: GetOrdersQuery) {
  const filters: ReturnType<typeof eq>[] = [];

  if (query.status) filters.push(eq(orders.status, query.status));
  if (query.currency) filters.push(eq(orders.currency, query.currency));
  if (query.orderType) filters.push(eq(orders.orderType, query.orderType));

  if (query.cursorOrderId) {
    filters.push(lt(orders.orderId, query.cursorOrderId) as ReturnType<typeof eq>);
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

export async function getOrder(db: DB, orderId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderId, orderId))
    .limit(1);

  return order ?? null;
}

export async function getOrderEvents(db: DB, orderId: string) {
  return db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(desc(orderEvents.blockNumber), desc(orderEvents.logIndex));
}
