PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_block_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`block_number` integer NOT NULL,
	`currency` text NOT NULL,
	`currency_hex` text NOT NULL,
	`buy_price` real NOT NULL,
	`sell_price` real NOT NULL,
	`buy_price_offset` real NOT NULL,
	`base_spread` real NOT NULL,
	`block_timestamp` text DEFAULT '' NOT NULL,
	`block_timestamp_unix` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_block_prices`("id", "block_number", "currency", "currency_hex", "buy_price", "sell_price", "buy_price_offset", "base_spread", "block_timestamp", "block_timestamp_unix", "created_at") SELECT "id", "block_number", "currency", "currency_hex", "buy_price", "sell_price", "buy_price_offset", "base_spread", "block_timestamp", "block_timestamp_unix", "created_at" FROM `block_prices`;--> statement-breakpoint
DROP TABLE `block_prices`;--> statement-breakpoint
ALTER TABLE `__new_block_prices` RENAME TO `block_prices`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_block_prices_block_currency` ON `block_prices` (`block_number`,`currency`);--> statement-breakpoint
CREATE INDEX `idx_block_prices_currency` ON `block_prices` (`currency`);