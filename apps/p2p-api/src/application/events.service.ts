import { eq, desc, and, or, gte, lte, lt } from "drizzle-orm";
import { orderEvents } from "@p2p-me/db";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@p2p-me/db";

type DB = DrizzleD1Database<typeof schema>;

export interface GetEventsQuery {
  cursorBlock?: number;
  cursorLog?: number;
  limit: number;
  eventName?: string;
  orderId?: number;
  fromBlock?: number;
  toBlock?: number;
}

export async function getEvents(db: DB, query: GetEventsQuery) {
  const filters: ReturnType<typeof eq | typeof gte | typeof lte>[] = [];

  if (query.eventName) filters.push(eq(orderEvents.eventName, query.eventName));
  if (query.orderId) filters.push(eq(orderEvents.orderId, query.orderId));
  if (query.fromBlock) filters.push(gte(orderEvents.blockNumber, query.fromBlock));
  if (query.toBlock) filters.push(lte(orderEvents.blockNumber, query.toBlock));

  if (query.cursorBlock != null && query.cursorLog != null) {
    const compound = or(
      lt(orderEvents.blockNumber, query.cursorBlock),
      and(eq(orderEvents.blockNumber, query.cursorBlock), lt(orderEvents.logIndex, query.cursorLog)),
    );
    if (compound) filters.push(compound as ReturnType<typeof eq>);
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  const items = await db
    .select()
    .from(orderEvents)
    .where(where)
    .orderBy(desc(orderEvents.blockNumber), desc(orderEvents.logIndex))
    .limit(query.limit);

  const last = items[items.length - 1];
  return {
    items,
    nextCursorBlock: items.length === query.limit ? last.blockNumber : null,
    nextCursorLog: items.length === query.limit ? (last.logIndex ?? 0) : null,
  };
}
