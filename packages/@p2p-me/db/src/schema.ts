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
  orderIdBlockLogIdx: index("idx_events_order_id_block_log")
    .on(table.orderId, table.blockNumber, table.logIndex),
}));

export const processorState = sqliteTable("processor_state", {
  id: integer("id").primaryKey(),
  lastBlock: integer("last_block").notNull(),
  updatedAt: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
});

export const blockPrices = sqliteTable("block_prices", {
  id: text("id").primaryKey(),
  blockNumber: integer("block_number").notNull(),
  currency: text("currency").notNull(),
  currencyHex: text("currency_hex").notNull(),
  buyPrice: real("buy_price").notNull(),
  sellPrice: real("sell_price").notNull(),
  binanceBuyPrice: real("binance_buy_price").notNull().default(0),
  binanceSellPrice: real("binance_sell_price").notNull().default(0),
  buyPriceOffset: real("buy_price_offset").notNull(),
  baseSpread: real("base_spread").notNull(),
  blockTimestamp: text("block_timestamp").notNull().default(""),
  blockTimestampUnix: integer("block_timestamp_unix").notNull().default(0),
  createdAt: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
}, (table) => ({
  blockCurrencyUnique: uniqueIndex("idx_block_prices_block_currency")
    .on(table.blockNumber, table.currency),
  currencyIdx: index("idx_block_prices_currency")
    .on(table.currency),
}));

export const arbitrageOpportunities = sqliteTable("arbitrage_opportunities", {
  id: text("id").primaryKey(),
  blockNumber: integer("block_number").notNull(),
  route: text("route").notNull(), // "LADO_1" | "LADO_2"
  currency: text("currency").notNull().default("VES"),
  contractBuyPrice: real("contract_buy_price").notNull(),
  contractSellPrice: real("contract_sell_price").notNull(),
  binanceBuyPrice: real("binance_buy_price").notNull(),
  binanceSellPrice: real("binance_sell_price").notNull(),
  spreadGross: real("spread_gross").notNull(),
  marginPct: real("margin_pct").notNull(),
  profitUsdc: real("profit_usdc").notNull(),
  blockTimestampIso: text("block_timestamp_iso").notNull().default(""),
  createdAt: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
}, (table) => ({
  blockRouteUnique: uniqueIndex("idx_opps_block_route")
    .on(table.blockNumber, table.route),
  marginPctIdx: index("idx_opps_margin_pct")
    .on(table.marginPct),
}));

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type NewOrderEvent = typeof orderEvents.$inferInsert;
export type ProcessorState = typeof processorState.$inferSelect;
export type BlockPrice = typeof blockPrices.$inferSelect;
export type NewBlockPrice = typeof blockPrices.$inferInsert;
export type ArbitrageOpportunity = typeof arbitrageOpportunities.$inferSelect;
export type NewArbitrageOpportunity = typeof arbitrageOpportunities.$inferInsert;
