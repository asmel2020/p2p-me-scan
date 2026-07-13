import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  orderId: integer("order_id").notNull().unique(),
  user: text("user").notNull(),
  merchant: text("merchant").notNull().default("-"),
  recipientAddr: text("recipient_addr").notNull().default("-"),
  acceptedMerchant: text("accepted_merchant").notNull().default("-"),
  usdc: real("usdc").notNull().default(0),
  fiat: real("fiat").notNull().default(0),
  orderType: text("order_type").notNull().default("-"),
  currency: text("currency").notNull().default("-"),
  status: text("status").notNull().default("placed"),
  createdBlock: integer("created_block").notNull(),
  updatedBlock: integer("updated_block").notNull(),
  blockTimestamp: text("block_timestamp").notNull().default(""),
  blockTimestampUnix: integer("block_timestamp_unix").notNull().default(0),
  createdAt: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
}, (table) => ({
  statusUpdatedBlockIdx: index("idx_orders_status_updated_block")
    .on(table.status, table.updatedBlock),
  currencyUpdatedBlockIdx: index("idx_orders_currency_updated_block")
    .on(table.currency, table.updatedBlock),
  orderTypeUpdatedBlockIdx: index("idx_orders_order_type_updated_block")
    .on(table.orderType, table.updatedBlock),
}));

export const orderEvents = sqliteTable("order_events", {
  id: text("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.orderId),
  eventName: text("event_name").notNull(),
  user: text("user").notNull(),
  merchant: text("merchant").notNull().default("-"),
  recipientAddr: text("recipient_addr").notNull().default("-"),
  acceptedMerchant: text("accepted_merchant").notNull().default("-"),
  usdc: real("usdc").notNull().default(0),
  fiat: real("fiat").notNull().default(0),
  orderType: text("order_type").notNull().default("-"),
  currency: text("currency").notNull().default("-"),
  blockNumber: integer("block_number").notNull(),
  blockTimestamp: text("block_timestamp").notNull().default(""),
  blockTimestampUnix: integer("block_timestamp_unix").notNull().default(0),
  txHash: text("tx_hash").notNull(),
  logIndex: integer("log_index"),
  createdAt: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
}, (table) => ({
  blockNumberLogIndexIdx: index("idx_events_block_number_log_index")
    .on(table.blockNumber, table.logIndex),
  txHashLogIndexUnique: uniqueIndex("idx_events_tx_hash_log_index_unique")
    .on(table.txHash, table.logIndex),
}));

export const processorState = sqliteTable("processor_state", {
  id: integer("id").primaryKey(),
  lastBlock: integer("last_block").notNull(),
  updatedAt: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type NewOrderEvent = typeof orderEvents.$inferInsert;
export type ProcessorState = typeof processorState.$inferSelect;
