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
	`tx_hash` text NOT NULL,
	`log_index` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_id_unique` ON `orders` (`order_id`);