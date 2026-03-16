CREATE TABLE `chat` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`default_model` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `node` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`parent_id` text,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chat`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `node_chat_id_idx` ON `node` (`chat_id`);--> statement-breakpoint
CREATE INDEX `node_parent_id_idx` ON `node` (`parent_id`);--> statement-breakpoint
CREATE TABLE `node_metadata` (
	`node_id` text PRIMARY KEY NOT NULL,
	`provider` text,
	`model` text,
	`temperature` real,
	`tools_called` text,
	`files` text,
	`token_count` integer,
	FOREIGN KEY (`node_id`) REFERENCES `node`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `node_metadata_provider_idx` ON `node_metadata` (`provider`);--> statement-breakpoint
CREATE INDEX `node_metadata_model_idx` ON `node_metadata` (`model`);
