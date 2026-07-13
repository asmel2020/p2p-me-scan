import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { initDB } from "@p2p-me/db/client";
import { orderQuerySchema } from "../schemas";
import { getOrders, getOrder, getOrderEvents } from "../../application/orders.service";
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

  const order = await getOrder(db, orderId);
  if (!order) return c.json({ error: "Order not found" }, 404);

  const events = await getOrderEvents(db, orderId);
  return c.json({ ...order, events });
});

app.get("/:orderId/events", async (c) => {
  const db = initDB(c.env.DB);
  const orderId = Number(c.req.param("orderId"));

  const order = await getOrder(db, orderId);
  if (!order) return c.json({ error: "Order not found" }, 404);

  const events = await getOrderEvents(db, orderId);
  return c.json({ orderId, events, total: events.length });
});

export default app;
