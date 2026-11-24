CREATE TYPE "public"."asset_class" AS ENUM('equity', 'fixed_income', 'cash', 'commodity', 'real_estate', 'crypto', 'fund', 'derivative');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('active', 'suspended', 'matured', 'disposed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('buy', 'sell', 'transfer_in', 'transfer_out', 'dividend', 'interest', 'fee', 'revaluation');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" bigint NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"isin" char(12),
	"name" varchar(255) NOT NULL,
	"asset_class" "asset_class" NOT NULL,
	"status" "asset_status" DEFAULT 'active' NOT NULL,
	"currency" char(3) NOT NULL,
	"country" char(2) NOT NULL,
	"quantity" numeric(28, 8) NOT NULL,
	"cost_basis" numeric(24, 4) NOT NULL,
	"market_value" numeric(24, 4) NOT NULL,
	"valued_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_isin_format" CHECK ("assets"."isin" ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
	CONSTRAINT "assets_country_format" CHECK ("assets"."country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "assets_cost_basis_non_negative" CHECK ("assets"."cost_basis" >= 0),
	CONSTRAINT "assets_version_positive" CHECK ("assets"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" varchar(128) NOT NULL,
	"action" varchar(32) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" varchar(64) NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" char(3) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"minor_units" smallint DEFAULT 2 NOT NULL,
	CONSTRAINT "currencies_code_format" CHECK ("currencies"."code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "currencies_minor_units_range" CHECK ("currencies"."minor_units" between 0 and 4)
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "portfolios_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"base_currency" char(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" bigint NOT NULL,
	"type" "transaction_type" NOT NULL,
	"trade_date" date NOT NULL,
	"settle_date" date,
	"quantity" numeric(28, 8) NOT NULL,
	"price" numeric(24, 8),
	"amount" numeric(24, 4) NOT NULL,
	"currency" char(3) NOT NULL,
	"idempotency_key" varchar(64) NOT NULL,
	"reverses_id" bigint,
	"memo" text,
	"created_by" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_settle_after_trade" CHECK ("transactions"."settle_date" is null or "transactions"."settle_date" >= "transactions"."trade_date"),
	CONSTRAINT "transactions_not_self_reversing" CHECK ("transactions"."reverses_id" is distinct from "transactions"."id")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_base_currency_currencies_code_fk" FOREIGN KEY ("base_currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reverses_id_transactions_id_fk" FOREIGN KEY ("reverses_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_public_id_key" ON "assets" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "assets_name_id_idx" ON "assets" USING btree ("name","id");--> statement-breakpoint
CREATE INDEX "assets_symbol_id_idx" ON "assets" USING btree ("symbol","id");--> statement-breakpoint
CREATE INDEX "assets_market_value_id_idx" ON "assets" USING btree ("market_value","id");--> statement-breakpoint
CREATE INDEX "assets_updated_at_id_idx" ON "assets" USING btree ("updated_at","id");--> statement-breakpoint
CREATE INDEX "assets_portfolio_id_idx" ON "assets" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "assets_asset_class_idx" ON "assets" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "assets_status_idx" ON "assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assets_currency_idx" ON "assets" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "assets_isin_idx" ON "assets" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "assets_name_trgm_idx" ON "assets" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "assets_symbol_trgm_idx" ON "assets" USING gin ("symbol" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolios_code_key" ON "portfolios" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_public_id_key" ON "transactions" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_reverses_id_key" ON "transactions" USING btree ("reverses_id");--> statement-breakpoint
CREATE INDEX "transactions_asset_trade_date_idx" ON "transactions" USING btree ("asset_id","trade_date","id");--> statement-breakpoint
CREATE INDEX "transactions_trade_date_id_idx" ON "transactions" USING btree ("trade_date","id");