import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { initDB } from "@p2p-me/db/client";
import { getDailyTransferability } from "../../application/analytics.service";

const querySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  currency: z.string().max(10).optional(),
});

const app = new Hono<{ Bindings: { DB: D1Database } }>();

app.get("/daily-transferability", zValidator("query", querySchema), async (c) => {
  const db = initDB(c.env.DB);
  const query = c.req.valid("query");

  const data = await getDailyTransferability(db, query);

  return c.json(data);
});

export default app;
