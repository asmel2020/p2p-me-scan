CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`event_name` text NOT NULL,
	`user` text NOT NULL,
	`merchant` text DEFAULT '-' NOT NULL,
	`recipient_addr` text DEFAULT '-' NOT NULL,
	`accepted_merchant` text DEFAULT '-' NOT NULL,
	`usdc` real DEFAULT 0 NOT NULL,
	`fiat` real DEFAULT 0 NOT NULL,
	`order_type` text DEFAULT '-' NOT NULL,
	`currency` text DEFAULT '-' NOT NULL,
	`block_number` integer NOT NULL,
	`block_timestamp` text DEFAULT '' NOT NULL,
	`block_timestamp_unix` integer DEFAULT 0 NOT NULL,
	`tx_hash` text NOT NULL,
	`log_index` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_events_block_number_log_index` ON `order_events` (`block_number`,`log_index`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_events_tx_hash_log_index_unique` ON `order_events` (`tx_hash`,`log_index`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`user` text NOT NULL,
	`merchant` text DEFAULT '-' NOT NULL,
	`recipient_addr` text DEFAULT '-' NOT NULL,
	`accepted_merchant` text DEFAULT '-' NOT NULL,
	`usdc` real DEFAULT 0 NOT NULL,
	`fiat` real DEFAULT 0 NOT NULL,
	`order_type` text DEFAULT '-' NOT NULL,
	`currency` text DEFAULT '-' NOT NULL,
	`status` text DEFAULT 'placed' NOT NULL,
	`created_block` integer NOT NULL,
	`updated_block` integer NOT NULL,
	`block_timestamp` text DEFAULT '' NOT NULL,
	`block_timestamp_unix` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_id_unique` ON `orders` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_status_updated_block` ON `orders` (`status`,`updated_block`);--> statement-breakpoint
CREATE INDEX `idx_orders_currency_updated_block` ON `orders` (`currency`,`updated_block`);--> statement-breakpoint
CREATE INDEX `idx_orders_order_type_updated_block` ON `orders` (`order_type`,`updated_block`);--> statement-breakpoint
CREATE TABLE `processor_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_block` integer NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
