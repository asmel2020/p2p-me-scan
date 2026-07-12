import { Hono } from "hono";
import { cors } from "hono/cors";
import ordersRouter from "./presentation/routes/orders";
import eventsRouter from "./presentation/routes/events";
import statsRouter from "./presentation/routes/stats";
import analyticsRouter from "./presentation/routes/analytics";

export type Env = { DB: D1Database };

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

const v1 = new Hono<{ Bindings: Env }>();

v1.get("/status", (c) => c.json({ status: "ok", service: "p2p-api", version: "v1" }));

v1.route("/orders", ordersRouter);
v1.route("/events", eventsRouter);
v1.route("/stats", statsRouter);
v1.route("/analytics", analyticsRouter);

app.route("/v1", v1);

export default app;
