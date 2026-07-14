import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, desc } from "drizzle-orm";
import { initDB } from "@p2p-me/db/client";
import { orders, orderEvents } from "@p2p-me/db";
import { orderQuerySchema } from "../schemas";
import { getOrders } from "../../application/orders.service";
import { encodeCursor, decodeCursor } from "../helpers/cursor";

const app = new Hono<{ Bindings: { DB: D1Database } }>();

app.get("/", zValidator("query", orderQuerySchema), async (c) => {
  const db = initDB(c.env.DB);
  const query = c.req.valid("query");
  const cursorOrderId = query.cursor
    ? (decodeCursor(query.cursor)?.o as number | undefined)
    : undefined;

  const result = await getOrders(db, { ...query, cursorOrderId });

  const nextCursor = result.nextCursorOrderId
    ? encodeCursor({ o: result.nextCursorOrderId })
    : null;

  return c.json({ data: result.items, nextCursor });
});

app.get("/:orderId", async (c) => {
  const db = initDB(c.env.DB);
  const orderId = Number(c.req.param("orderId"));

  const [orderResult, events] = await db.batch([
    db.select().from(orders).where(eq(orders.orderId, orderId)).limit(1),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId))
      .orderBy(desc(orderEvents.blockNumber), desc(orderEvents.logIndex))
      .limit(5),
  ]);

  const order = orderResult[0] ?? null;
  if (!order) return c.json({ error: "Order not found" }, 404);

  return c.json({ ...order, events });
});

app.get("/:orderId/events", async (c) => {
  const db = initDB(c.env.DB);
  const orderId = Number(c.req.param("orderId"));

  const [orderResult, events] = await db.batch([
    db.select().from(orders).where(eq(orders.orderId, orderId)).limit(1),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId))
      .orderBy(desc(orderEvents.blockNumber), desc(orderEvents.logIndex))
      .limit(5),
  ]);

  const order = orderResult[0] ?? null;
  if (!order) return c.json({ error: "Order not found" }, 404);

  return c.json({ orderId, events, total: events.length });
});

export default app;
