CREATE TABLE `block_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`block_number` integer NOT NULL,
	`currency` text NOT NULL,
	`currency_hex` text NOT NULL,
	`buy_price` text NOT NULL,
	`sell_price` text NOT NULL,
	`buy_price_offset` text NOT NULL,
	`base_spread` text NOT NULL,
	`block_timestamp` text DEFAULT '' NOT NULL,
	`block_timestamp_unix` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_block_prices_block_currency` ON `block_prices` (`block_number`,`currency`);--> statement-breakpoint
CREATE INDEX `idx_block_prices_currency` ON `block_prices` (`currency`);