CREATE TABLE `arbitrage_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`block_number` integer NOT NULL,
	`route` text NOT NULL,
	`currency` text DEFAULT 'VES' NOT NULL,
	`contract_buy_price` real NOT NULL,
	`contract_sell_price` real NOT NULL,
	`binance_buy_price` real NOT NULL,
	`binance_sell_price` real NOT NULL,
	`spread_gross` real NOT NULL,
	`margin_pct` real NOT NULL,
	`profit_usdc` real NOT NULL,
	`block_timestamp_iso` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_opps_block_route` ON `arbitrage_opportunities` (`block_number`,`route`);--> statement-breakpoint
CREATE INDEX `idx_opps_margin_pct` ON `arbitrage_opportunities` (`margin_pct`);