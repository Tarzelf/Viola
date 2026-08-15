CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" uuid NOT NULL,
	"followee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"avatar_path" text,
	"bio" text,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"look_count" integer DEFAULT 0 NOT NULL,
	"total_blooms_received" integer DEFAULT 0 NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"auth_provider_id" text,
	"email_verified_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"look_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "look_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"look_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"category" text NOT NULL,
	"subtype" text NOT NULL,
	"brand" text,
	"title" text,
	"description" text,
	"colors" jsonb DEFAULT '[]'::jsonb,
	"pattern" text,
	"material" text,
	"bbox" jsonb NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"search_query" text,
	"product_id" uuid,
	"is_user_corrected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "look_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"look_id" uuid NOT NULL,
	"viewer_hash" text NOT NULL,
	"source" text DEFAULT 'feed' NOT NULL,
	"referrer_handle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "looks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"photo_path" text NOT NULL,
	"photo_width" integer,
	"photo_height" integer,
	"photo_blurhash" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"failure_reason" text,
	"caption" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"score" integer,
	"score_breakdown" jsonb,
	"archetype_id" text,
	"style_tags" jsonb DEFAULT '[]'::jsonb,
	"layout" jsonb,
	"story_card_path" text,
	"og_card_path" text,
	"square_card_path" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"bloom_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"look_item_id" uuid,
	"look_id" uuid,
	"product_id" uuid,
	"user_id" uuid,
	"guest_id" text,
	"provider" text NOT NULL,
	"target_url" text NOT NULL,
	"merchant_url" text NOT NULL,
	"tracking_id" text NOT NULL,
	"ip_hash" text,
	"user_agent_hash" text,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_transaction_id" text NOT NULL,
	"click_id" uuid,
	"merchant" text,
	"order_value_cents" integer,
	"commission_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"occurred_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"retailer" text NOT NULL,
	"url" text NOT NULL,
	"price_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"image_path" text,
	"is_secondhand" boolean DEFAULT false NOT NULL,
	"is_dupe" boolean DEFAULT false NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_hash" text NOT NULL,
	"normalised_query" text NOT NULL,
	"brand" text,
	"title" text NOT NULL,
	"description" text,
	"image_path" text,
	"image_source_url" text,
	"image_trimmed" boolean DEFAULT false NOT NULL,
	"source" text,
	"merchant_url" text NOT NULL,
	"price_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"rating" real,
	"review_count" integer,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsored_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_name" text NOT NULL,
	"headline" text NOT NULL,
	"body" text,
	"image_path" text NOT NULL,
	"cta_label" text DEFAULT 'Shop' NOT NULL,
	"target_url" text NOT NULL,
	"frequency" integer DEFAULT 7 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"impression_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"look_id" uuid,
	"look_item_id" uuid,
	"product_id" uuid,
	"note" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"cover_look_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"look_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 4 NOT NULL,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"last_error" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spend_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" text NOT NULL,
	"provider" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"status" text NOT NULL,
	"plan" text,
	"external_customer_id" text,
	"external_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_quota" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"looks_tagged" integer DEFAULT 0 NOT NULL,
	"searches_used" integer DEFAULT 0 NOT NULL,
	"estimated_cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_users_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blooms" ADD CONSTRAINT "blooms_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blooms" ADD CONSTRAINT "blooms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "look_items" ADD CONSTRAINT "look_items_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "look_views" ADD CONSTRAINT "look_views_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "looks" ADD CONSTRAINT "looks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_look_item_id_look_items_id_fk" FOREIGN KEY ("look_item_id") REFERENCES "public"."look_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_transactions" ADD CONSTRAINT "affiliate_transactions_click_id_affiliate_clicks_id_fk" FOREIGN KEY ("click_id") REFERENCES "public"."affiliate_clicks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_look_item_id_look_items_id_fk" FOREIGN KEY ("look_item_id") REFERENCES "public"."look_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_cover_look_id_looks_id_fk" FOREIGN KEY ("cover_look_id") REFERENCES "public"."looks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_quota" ADD CONSTRAINT "usage_quota_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "follows_followee_idx" ON "follows" USING btree ("followee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_handle_key" ON "profiles" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_provider_id_key" ON "users" USING btree ("auth_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blooms_look_user_key" ON "blooms" USING btree ("look_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blooms_look_guest_key" ON "blooms" USING btree ("look_id","guest_id");--> statement-breakpoint
CREATE INDEX "blooms_look_idx" ON "blooms" USING btree ("look_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "blooms_user_idx" ON "blooms" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "look_items_look_rank_idx" ON "look_items" USING btree ("look_id","rank");--> statement-breakpoint
CREATE INDEX "look_items_product_idx" ON "look_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "look_views_look_idx" ON "look_views" USING btree ("look_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "look_views_dedupe_idx" ON "look_views" USING btree ("look_id","viewer_hash","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "looks_slug_key" ON "looks" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "looks_user_created_idx" ON "looks" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "looks_feed_idx" ON "looks" USING btree ("status","visibility","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "looks_top_idx" ON "looks" USING btree ("status","visibility","bloom_count" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_clicks_tracking_id_key" ON "affiliate_clicks" USING btree ("tracking_id");--> statement-breakpoint
CREATE INDEX "affiliate_clicks_look_idx" ON "affiliate_clicks" USING btree ("look_id","clicked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "affiliate_clicks_user_idx" ON "affiliate_clicks" USING btree ("user_id","clicked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_txn_provider_key" ON "affiliate_transactions" USING btree ("provider","provider_transaction_id");--> statement-breakpoint
CREATE INDEX "affiliate_txn_click_idx" ON "affiliate_transactions" USING btree ("click_id");--> statement-breakpoint
CREATE INDEX "product_offers_product_idx" ON "product_offers" USING btree ("product_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "products_query_hash_key" ON "products" USING btree ("query_hash");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "products_refreshed_idx" ON "products" USING btree ("refreshed_at");--> statement-breakpoint
CREATE INDEX "sponsored_active_idx" ON "sponsored_placements" USING btree ("is_active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "vault_items_vault_idx" ON "vault_items" USING btree ("vault_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_items_unique_look" ON "vault_items" USING btree ("vault_id","look_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_items_unique_item" ON "vault_items" USING btree ("vault_id","look_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_items_unique_product" ON "vault_items" USING btree ("vault_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vaults_slug_key" ON "vaults" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "vaults_user_idx" ON "vaults" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "vaults_one_default_per_user" ON "vaults" USING btree ("user_id") WHERE "vaults"."is_default";--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "jobs_look_idx" ON "jobs" USING btree ("look_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_look_stage_key" ON "jobs" USING btree ("look_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "spend_ledger_day_provider_key" ON "spend_ledger" USING btree ("day","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_platform_key" ON "subscriptions" USING btree ("user_id","platform");--> statement-breakpoint
CREATE INDEX "subscriptions_external_idx" ON "subscriptions" USING btree ("external_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_quota_user_period_key" ON "usage_quota" USING btree ("user_id","period");