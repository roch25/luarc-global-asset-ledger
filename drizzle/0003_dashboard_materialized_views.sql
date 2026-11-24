-- Pre-aggregated materialized views for sub-millisecond dashboard analytics over millions of rows.
-- Unique indexes enable `REFRESH MATERIALIZED VIEW CONCURRENTLY` with zero read blocking.

CREATE MATERIALIZED VIEW mv_ledger_summary AS
SELECT
  asset_class,
  status,
  currency,
  count(*)::bigint AS asset_count,
  coalesce(sum(cost_basis), 0)::numeric(30, 4) AS total_cost_basis,
  coalesce(sum(market_value), 0)::numeric(30, 4) AS total_market_value,
  max(valued_at) AS last_valued_at
FROM assets
GROUP BY asset_class, status, currency;

CREATE UNIQUE INDEX mv_ledger_summary_pk
  ON mv_ledger_summary (asset_class, status, currency);

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
  coalesce(sum(a.market_value), 0)::numeric(30, 4) AS total_market_value
FROM assets a
JOIN portfolios p ON p.id = a.portfolio_id
GROUP BY a.portfolio_id, p.code, p.name, p.base_currency, a.currency;

CREATE UNIQUE INDEX mv_portfolio_summary_pk
  ON mv_portfolio_summary (portfolio_id, currency);

CREATE INDEX mv_portfolio_summary_currency_mv_idx
  ON mv_portfolio_summary (currency, total_market_value DESC);
