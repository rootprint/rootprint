ALTER TABLE `user` ADD `username` text;--> statement-breakpoint
ALTER TABLE `user` ADD `display_username` text;--> statement-breakpoint
ALTER TABLE `user` ADD `must_change_password` integer DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);