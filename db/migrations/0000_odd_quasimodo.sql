CREATE TABLE `ai_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_type` text NOT NULL,
	`provider_name` text NOT NULL,
	`api_endpoint_url` text,
	`api_secret_key` text,
	`model_name` text NOT NULL,
	`is_active` integer DEFAULT false,
	`is_vision_capable` integer DEFAULT false,
	`max_tokens` integer DEFAULT 4096,
	`temperature` real DEFAULT 0.3,
	`timeout_seconds` integer DEFAULT 120,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `appearance` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`theme` text DEFAULT 'dark',
	`template` text DEFAULT 'standard',
	`hospital_name` text DEFAULT '',
	`logo` text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE `config` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`n8n_webhook_url` text DEFAULT '',
	`supabase_url` text DEFAULT '',
	`supabase_anon_key` text DEFAULT '',
	`pacs_orthanc_url` text DEFAULT '',
	`pacs_auth_type` text DEFAULT 'none',
	`pacs_username` text DEFAULT '',
	`pacs_password` text DEFAULT '',
	`pacs_bearer_token` text DEFAULT '',
	`pacs_ae_title` text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id_number` text,
	`patient_name` text NOT NULL,
	`date_of_birth` text,
	`gender` text,
	`contact_info` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`full_name` text DEFAULT '',
	`role` text DEFAULT '',
	`hospital_name` text DEFAULT '',
	`department` text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`template` text NOT NULL,
	`is_active` integer DEFAULT false,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `report_generation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text,
	`ai_config_id` text,
	`model_used` text,
	`prompt_template_id` text,
	`raw_llm_response` text,
	`parsed_successfully` integer,
	`retry_count` integer,
	`generation_time_ms` integer,
	`error_message` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`ai_config_id`) REFERENCES `ai_configurations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text,
	`patient_name` text,
	`modality` text,
	`urgency` text,
	`report_status` text DEFAULT 'Pending',
	`report_data` text NOT NULL,
	`image_data` text,
	`pacs_study_uid` text,
	`pacs_series_uid` text,
	`pacs_source` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'User',
	`position` text DEFAULT '',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);