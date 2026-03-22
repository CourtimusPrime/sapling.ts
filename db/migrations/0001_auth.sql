CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_api_key` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `provider`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `chat` ADD COLUMN `user_id` text REFERENCES `user`(`id`);
