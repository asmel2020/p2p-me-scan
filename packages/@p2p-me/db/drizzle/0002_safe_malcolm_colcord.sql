CREATE INDEX `idx_events_block_number_log_index` ON `order_events` (`block_number`,`log_index`);--> statement-breakpoint
CREATE INDEX `idx_orders_status_updated_block` ON `orders` (`status`,`updated_block`);--> statement-breakpoint
CREATE INDEX `idx_orders_currency_updated_block` ON `orders` (`currency`,`updated_block`);--> statement-breakpoint
CREATE INDEX `idx_orders_order_type_updated_block` ON `orders` (`order_type`,`updated_block`);