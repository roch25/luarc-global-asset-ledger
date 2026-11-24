CREATE TYPE "public"."depreciation_method" AS ENUM('none', 'straight_line', 'declining_balance', 'units_of_production');--> statement-breakpoint
ALTER TYPE "public"."transaction_type" ADD VALUE 'depreciation';--> statement-breakpoint
ALTER TYPE "public"."transaction_type" ADD VALUE 'disposal';--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "acquisition_date" date DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "supplier" varchar(128);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "depreciation_method" "depreciation_method" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "useful_life_months" integer;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "salvage_value" numeric(24, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "accumulated_depreciation" numeric(24, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "disposal_date" date;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "disposal_value" numeric(24, 4);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "retirement_reason" varchar(160);--> statement-breakpoint
CREATE INDEX "assets_depreciation_method_idx" ON "assets" USING btree ("depreciation_method");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_useful_life_positive" CHECK ("assets"."useful_life_months" is null or "assets"."useful_life_months" > 0);--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_salvage_range" CHECK ("assets"."salvage_value" >= 0 and "assets"."salvage_value" <= "assets"."cost_basis");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_accum_depreciation_range" CHECK ("assets"."accumulated_depreciation" >= 0 and "assets"."accumulated_depreciation" <= "assets"."cost_basis");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_disposal_after_acquisition" CHECK ("assets"."disposal_date" is null or "assets"."disposal_date" >= "assets"."acquisition_date");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_disposal_value_non_negative" CHECK ("assets"."disposal_value" is null or "assets"."disposal_value" >= 0);--> statement-breakpoint
DROP MATERIALIZED VIEW IF EXISTS mv_ledger_summary;--> statement-breakpoint
CREATE MATERIALIZED VIEW mv_ledger_summary AS
SELECT
  asset_class,
  status,
  currency,
  count(*)::bigint AS asset_count,
  coalesce(sum(cost_basis), 0)::numeric(30, 4) AS total_cost_basis,
  coalesce(sum(accumulated_depreciation), 0)::numeric(30, 4) AS total_accumulated_depreciation,
  coalesce(sum(market_value), 0)::numeric(30, 4) AS total_market_value,
  coalesce(sum(disposal_value), 0)::numeric(30, 4) AS total_disposal_value,
  max(valued_at) AS last_valued_at
FROM assets
GROUP BY asset_class, status, currency;--> statement-breakpoint
CREATE UNIQUE INDEX mv_ledger_summary_pk
  ON mv_ledger_summary (asset_class, status, currency);--> statement-breakpoint
DROP MATERIALIZED VIEW IF EXISTS mv_portfolio_summary;--> statement-breakpoint
CREATE MATERIALIZED VIEW mv_portfolio_summary AS
SELECT
  a.portfolio_id,
  p.code AS portfolio_code,
  p.name AS portfolio_name,
  p.base_currency,
  a.currency,
  count(*)::bigint AS asset_count,
  count(*) FILTER (WHERE a.status = 'active')::bigint AS active_count,
  coalesce(sum(a.cost_basis), 0)::numeric(30, 4) AS total_cost_basis,
  coalesce(sum(a.accumulated_depreciation), 0)::numeric(30, 4) AS total_accumulated_depreciation,
  coalesce(sum(a.market_value), 0)::numeric(30, 4) AS total_market_value
FROM assets a
JOIN portfolios p ON p.id = a.portfolio_id
GROUP BY a.portfolio_id, p.code, p.name, p.base_currency, a.currency;--> statement-breakpoint
CREATE UNIQUE INDEX mv_portfolio_summary_pk
  ON mv_portfolio_summary (portfolio_id, currency);--> statement-breakpoint
CREATE INDEX mv_portfolio_summary_currency_mv_idx
  ON mv_portfolio_summary (currency, total_market_value DESC);