CREATE INDEX `invite_token_user` ON `invite_token` (`user_id`);--> statement-breakpoint
CREATE INDEX `invite_token_expires` ON `invite_token` (`expires_at`);--> statement-breakpoint
CREATE INDEX `search_history_user_executed` ON `search_history` (`user_id`,`executed_at`);--> statement-breakpoint
CREATE INDEX `search_history_user_index_executed` ON `search_history` (`user_id`,`index_name`,`executed_at`);