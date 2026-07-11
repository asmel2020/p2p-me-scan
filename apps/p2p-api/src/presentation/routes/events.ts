import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { initDB } from "@p2p-me/db/client";
import { eventQuerySchema } from "../schemas";
import { getEvents } from "../../application/events.service";
import { encodeCursor, decodeCursor } from "../helpers/cursor";

const app = new Hono<{ Bindings: { DB: D1Database } }>();

app.get("/", zValidator("query", eventQuerySchema), async (c) => {
  const db = initDB(c.env.DB);
  const query = c.req.valid("query");
  const decoded = query.cursor ? decodeCursor(query.cursor) : null;

  const result = await getEvents(db, {
    ...query,
    cursorBlock: decoded?.b as number | undefined,
    cursorLog: decoded?.l as number | undefined,
  });

  const nextCursor = result.nextCursorBlock != null
    ? encodeCursor({ b: result.nextCursorBlock, l: result.nextCursorLog! })
    : null;

  return c.json({ data: result.items, nextCursor });
});

export default app;
