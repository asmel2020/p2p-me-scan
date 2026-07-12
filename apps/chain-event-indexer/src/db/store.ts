import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@p2p-me/db";
import type { ChainEvent } from "../events";
import { v4 as uuidv4 } from "uuid";

const EVENT_STATUS_MAP: Record<string, string> = {
  OrderPlaced: "placed",
  OrderAccepted: "accepted",
  BuyOrderPaid: "paid",
  OrderCompleted: "completed",
  CancelledOrders: "cancelled",
};

export async function persistEvent(
  db: DrizzleD1Database<typeof schema>,
  event: ChainEvent,
): Promise<void> {
  const status = EVENT_STATUS_MAP[event.eventName] ?? "unknown";

  await db
    .insert(schema.orders)
    .values({
      id: uuidv4(),
      orderId: event.orderId,
      user: event.user,
      merchant: event.merchant,
      recipientAddr: event.recipientAddr,
      acceptedMerchant: event.acceptedMerchant,
      usdc: event.usdc,
      fiat: event.fiat,
      orderType: event.orderType,
      currency: event.currency,
      status,
      createdBlock: event.blockNumber,
      updatedBlock: event.blockNumber,
      blockTimestamp: event.blockTimestamp,
      blockTimestampUnix: event.blockTimestampUnix,
    })
    .onConflictDoUpdate({
      target: schema.orders.orderId,
      set: {
        merchant: event.merchant,
        recipientAddr: event.recipientAddr,
        acceptedMerchant: event.acceptedMerchant,
        usdc: event.usdc,
        fiat: event.fiat,
        orderType: event.orderType,
        currency: event.currency,
        status,
        updatedBlock: event.blockNumber,
        blockTimestamp: event.blockTimestamp,
        blockTimestampUnix: event.blockTimestampUnix,
        updatedAt: sql`(CURRENT_TIMESTAMP)`,
      },
    });

  await db
    .insert(schema.orderEvents)
    .values({
      id: uuidv4(),
      orderId: event.orderId,
      eventName: event.eventName,
      user: event.user,
      merchant: event.merchant,
      recipientAddr: event.recipientAddr,
      acceptedMerchant: event.acceptedMerchant,
      usdc: event.usdc,
      fiat: event.fiat,
      orderType: event.orderType,
      currency: event.currency,
      blockNumber: event.blockNumber,
      blockTimestamp: event.blockTimestamp,
      blockTimestampUnix: event.blockTimestampUnix,
      txHash: event.txHash,
      logIndex: event.logIndex,
    })
    .onConflictDoNothing();
}
