import type { NextRequest } from "next/server";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api">) {
  return Response.json({ hola: "hola" });
}
