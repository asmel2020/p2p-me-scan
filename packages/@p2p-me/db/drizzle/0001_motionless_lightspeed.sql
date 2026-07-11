CREATE TABLE `processor_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_block` integer NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
