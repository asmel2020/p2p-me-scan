import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@p2p-me/db";

export async function getLastBlock(
  db: DrizzleD1Database<typeof schema>,
): Promise<bigint | null> {
  try {
    const [row] = await db
      .select()
      .from(schema.processorState)
      .where(eq(schema.processorState.id, 1))
      .limit(1);
    return row ? BigInt(row.lastBlock) : null;
  } catch {
    return null;
  }
}

export async function setLastBlock(
  db: DrizzleD1Database<typeof schema>,
  block: bigint,
): Promise<void> {
  await db
    .insert(schema.processorState)
    .values({ id: 1, lastBlock: Number(block) })
    .onConflictDoUpdate({
      target: schema.processorState.id,
      set: { lastBlock: Number(block) },
    });
}
