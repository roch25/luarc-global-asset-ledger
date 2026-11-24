/**
 * Development seed: generates a large, realistic-looking asset ledger entirely inside
 * Postgres (generate_series), so millions of rows load in about a minute instead of
 * streaming them from Node.
 *
 *   pnpm db:seed                    # 1,000,000 assets + 2,000,000 transactions
 *   pnpm db:seed --assets=5000000   # 5M assets
 *   pnpm db:seed --transactions=0   # skip the transaction ledger
 *   pnpm db:seed --batch=250000     # rows per INSERT batch
 *
 * Destructive: wipes currencies, portfolios, assets, transactions, and audit_log.
 * It refuses to run against a non-local host unless you pass --force.
 */
import postgres from 'postgres'

try {
  process.loadEnvFile('.env.local')
} catch {
  // Use the ambient environment.
}

function arg(name: string, fallback: number, min = 1): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
  if (raw === undefined) return fallback
  const value = Number(raw.replaceAll('_', ''))
  if (!Number.isSafeInteger(value) || value < min)
    throw new Error(`--${name} must be an integer >= ${min}`)
  return value
}

const TOTAL = arg('assets', 1_000_000)
const TRANSACTIONS = arg('transactions', 2_000_000, 0)
const BATCH = arg('batch', 100_000)
const PORTFOLIOS = arg('portfolios', 250)
const FORCE = process.argv.includes('--force')

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local.')

const host = new URL(url).hostname
if (!FORCE && !['localhost', '127.0.0.1', '::1', 'postgres'].includes(host)) {
  throw new Error(`Refusing to seed non-local database host "${host}". Pass --force to override.`)
}
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production.')

// One connection so session settings (setseed, replication role) apply to every statement.
const sql = postgres(url, { max: 1, onnotice: () => {} })

const fmt = new Intl.NumberFormat('en-US')
const t0 = performance.now()
const elapsed = () => `${((performance.now() - t0) / 1000).toFixed(1)}s`

const CANONICAL_ASSET_INDEXES: { indexname: string; indexdef: string }[] = [
  {
    indexname: 'assets_public_id_key',
    indexdef:
      'CREATE UNIQUE INDEX IF NOT EXISTS "assets_public_id_key" ON "assets" USING btree ("public_id")',
  },
  {
    indexname: 'assets_name_id_idx',
    indexdef:
      'CREATE INDEX IF NOT EXISTS "assets_name_id_idx" ON "assets" USING btree ("name","id")',
  },
  {
    indexname: 'assets_symbol_id_idx',
    indexdef:
      'CREATE INDEX IF NOT EXISTS "assets_symbol_id_idx" ON "assets" USING btree ("symbol","id")',
  },
  {
    indexname: 'assets_market_value_id_idx',
    indexdef:
      'CREATE INDEX IF NOT EXISTS "assets_market_value_id_idx" ON "assets" USING btree ("market_value","id")',
  },
  {
    indexname: 'assets_updated_at_id_idx',
    indexdef:
      'CREATE INDEX IF NOT EXISTS "assets_updated_at_id_idx" ON "assets" USING btree ("updated_at","id")',
  },
  {
    indexname: 'assets_portfolio_id_idx',
    indexdef:
      'CREATE INDEX IF NOT EXISTS "assets_portfolio_id_idx" ON "assets" USING btree ("portfolio_id")',
  },
  {
    indexname: 'assets_asset_class_idx',
    indexdef:
      'CREATE INDEX IF NOT EXISTS "assets_asset_class_idx" ON "assets" USING btree ("asset_class")',
  },
  {
    indexname: 'assets_status_idx',
    indexdef: 'CREATE INDEX IF NOT EXISTS "assets_status_idx" ON "assets" USING btree ("status")',
  },
  {
    indexname: 'assets_currency_idx',
    indexdef:
      'CREATE INDEX IF NOT EXISTS "assets_currency_idx" ON "assets" USING btree ("currency")',
  },
  {
    indexname: 'assets_depreciation_method_idx',
    indexdef:
      'CREATE INDEX IF NOT EXISTS "assets_depreciation_method_idx" ON "assets" USING btree ("depreciation_method")',
  },
  {
    indexname: 'assets_isin_idx',
    indexdef: 'CREATE INDEX IF NOT EXISTS "assets_isin_idx" ON "assets" USING btree ("isin")',
  },
  {
    indexname: 'assets_name_trgm_idx',
    indexdef:
      'CREATE INDEX IF NOT EXISTS "assets_name_trgm_idx" ON "assets" USING gin ("name" gin_trgm_ops)',
  },
  {
    indexname: 'assets_symbol_trgm_idx',
    indexdef:
      'CREATE INDEX IF NOT EXISTS "assets_symbol_trgm_idx" ON "assets" USING gin ("symbol" gin_trgm_ops)',
  },
]

async function main() {
  console.log(
    `Seeding ${fmt.format(TOTAL)} assets across ${PORTFOLIOS} portfolios (batch ${fmt.format(BATCH)})`,
  )

  // --- Reset -------------------------------------------------------------------
  // Append-only triggers on transactions/audit_log block TRUNCATE; session_replication_role
  // = replica disables them for this dev-only session.
  await sql`SET session_replication_role = replica`
  await sql`TRUNCATE audit_log, transactions, assets, portfolios, currencies RESTART IDENTITY CASCADE`
  await sql`SET session_replication_role = DEFAULT`
  await sql`SELECT setseed(0.4242)`

  // --- Reference data ----------------------------------------------------------
  await sql`
    INSERT INTO currencies (code, name, minor_units) VALUES
      ('USD', 'US Dollar', 2), ('EUR', 'Euro', 2), ('GBP', 'Pound Sterling', 2),
      ('JPY', 'Yen', 0), ('CHF', 'Swiss Franc', 2), ('CAD', 'Canadian Dollar', 2),
      ('AUD', 'Australian Dollar', 2), ('SGD', 'Singapore Dollar', 2),
      ('HKD', 'Hong Kong Dollar', 2), ('SEK', 'Swedish Krona', 2), ('INR', 'Indian Rupee', 2),
      ('BRL', 'Brazilian Real', 2), ('CNY', 'Yuan Renminbi', 2), ('BHD', 'Bahraini Dinar', 3)
  `

  await sql`
    INSERT INTO portfolios (code, name, base_currency)
    SELECT
      'PF-' || lpad(g::text, 4, '0'),
      (ARRAY['Global','Strategic','Core','Opportunistic','Sovereign','Pension','Endowment',
             'Treasury','Income','Growth','Balanced','Absolute Return'])[1 + floor(random() * 12)::int]
        || ' ' ||
      (ARRAY['Fund','Mandate','Portfolio','Reserve','Account','Trust'])[1 + floor(random() * 6)::int]
        || ' ' || g,
      (ARRAY['USD','USD','USD','EUR','EUR','GBP','JPY','CHF','SGD'])[1 + floor(random() * 9)::int]
    FROM generate_series(1, ${PORTFOLIOS}) g
  `

  // --- Drop secondary indexes for a fast bulk load, recreate afterwards -----------
  const existingIndexes = await sql<{ indexname: string; indexdef: string }[]>`
    SELECT i.indexname, i.indexdef
    FROM pg_indexes i
    LEFT JOIN pg_constraint c ON c.conname = i.indexname
    WHERE i.schemaname = 'public' AND i.tablename = 'assets' AND c.oid IS NULL
  `
  const indexesByName = new Map(CANONICAL_ASSET_INDEXES.map((idx) => [idx.indexname, idx]))
  for (const idx of existingIndexes) {
    if (!indexesByName.has(idx.indexname)) indexesByName.set(idx.indexname, idx)
  }
  const indexesToRestore = [...indexesByName.values()]

  for (const { indexname } of existingIndexes) await sql`DROP INDEX IF EXISTS ${sql(indexname)}`
  console.log(`[${elapsed()}] dropped ${existingIndexes.length} secondary indexes`)

  // --- Assets ------------------------------------------------------------------
  try {
    for (let start = 1; start <= TOTAL; start += BATCH) {
      const end = Math.min(start + BATCH - 1, TOTAL)
      await sql`
        INSERT INTO assets (
          portfolio_id, symbol, isin, name, asset_class, status, currency, country,
          quantity, cost_basis, market_value, valued_at,
          acquisition_date, supplier, depreciation_method, useful_life_months,
          salvage_value, accumulated_depreciation, disposal_date, disposal_value, retirement_reason,
          created_at, updated_at
        )
        SELECT
          s.portfolio_id,
          s.symbol,
          CASE WHEN s.cls IN ('cash', 'real_estate', 'crypto') THEN NULL
               ELSE s.country || upper(substr(md5(g::text), 1, 9)) || (g % 10)::text END,
          CASE s.cls
            WHEN 'fixed_income' THEN s.name || ' ' || to_char(0.5 + s.r1 * 7, 'FM0.000') || '% '
                                     || (2027 + floor(s.r2 * 25))::int
            WHEN 'cash'         THEN s.currency || ' Cash Deposit'
            WHEN 'crypto'       THEN s.name || ' Digital Token'
            WHEN 'derivative'   THEN s.name || ' ' || (ARRAY['Call','Put','Future','Swap'])[1 + floor(s.r1 * 4)::int]
            ELSE s.name
          END,
          s.cls::asset_class,
          s.status::asset_status,
          s.currency,
          s.country,
          s.qty,
          s.cb,
          s.mv,
          now() - s.r3 * interval '3 days',
          s.acq_date,
          s.supplier,
          s.depr_method::depreciation_method,
          CASE WHEN s.depr_method = 'none' THEN NULL ELSE s.life_months END,
          CASE WHEN s.depr_method = 'none' THEN 0
               ELSE round((s.cb * (0.05 + s.r1 * 0.10))::numeric, 4) END,
          CASE WHEN s.depr_method = 'none' THEN 0
               ELSE round((s.cb * least(0.85, 0.08 + s.r3 * 0.72))::numeric, 4) END,
          CASE WHEN s.status IN ('disposed', 'matured')
               THEN greatest(s.acq_date, (s.created + s.r3 * (now() - s.created))::date)
               ELSE NULL END,
          CASE WHEN s.status IN ('disposed', 'matured')
               THEN round((s.mv * (0.75 + s.r1 * 0.45))::numeric, 4)
               ELSE NULL END,
          CASE s.status
            WHEN 'disposed' THEN (ARRAY['Sold on secondary market','End of useful economic life',
                                        'Strategic portfolio rebalance','Obsolescence write-off'])
                                  [1 + floor(s.r2 * 4)::int]
            WHEN 'matured'  THEN 'Reached contractual maturity'
            ELSE NULL
          END,
          s.created,
          s.created + s.r3 * (now() - s.created)
        FROM generate_series(${start}::bigint, ${end}::bigint) g
        CROSS JOIN LATERAL (
          SELECT
            1 + floor(random() * ${PORTFOLIOS})::int AS portfolio_id,
            (ARRAY['equity','equity','equity','equity','fixed_income','fixed_income','fixed_income',
                   'fund','fund','cash','commodity','real_estate','crypto','derivative'])
              [1 + floor(random() * 14)::int] AS cls,
            (ARRAY['active','active','active','active','active','active','active','active',
                   'active','suspended','matured','disposed'])[1 + floor(random() * 12)::int] AS status,
            (ARRAY['USD','USD','USD','USD','EUR','EUR','GBP','JPY','CHF','CAD','AUD','SGD',
                   'HKD','SEK','INR','BRL','CNY','BHD'])[1 + floor(random() * 18)::int] AS currency,
            (ARRAY['US','US','US','GB','DE','FR','JP','CH','CA','AU','SG','HK','NL','SE',
                   'IN','BR','CN','LU','IE'])[1 + floor(random() * 19)::int] AS country,
            chr(65 + floor(random() * 26)::int) || chr(65 + floor(random() * 26)::int)
              || chr(65 + floor(random() * 26)::int)
              || CASE WHEN random() < 0.6 THEN chr(65 + floor(random() * 26)::int) ELSE '' END
              || CASE WHEN random() < 0.2 THEN '.' || chr(65 + floor(random() * 26)::int) ELSE '' END
              AS symbol,
            (ARRAY['Atlas','Boreal','Cobalt','Delta','Ember','Fjord','Granite','Harbor','Ion',
                   'Juniper','Keystone','Lumen','Meridian','Nimbus','Onyx','Pinnacle','Quartz',
                   'Redwood','Summit','Tidal','Umbra','Vertex','Willow','Xenon','Yarrow','Zenith',
                   'Aurora','Beacon','Crescent','Dominion','Equinox','Falcon'])
              [1 + floor(random() * 32)::int] || ' ' ||
            (ARRAY['Global','Pacific','Atlantic','Northern','Southern','Continental','United',
                   'Royal','National','Federal','Metropolitan','Coastal','Alpine','Eastern',
                   'Western','Central','Prime','First'])[1 + floor(random() * 18)::int] || ' ' ||
            (ARRAY['Holdings','Capital','Industries','Energy','Systems','Bancorp','Resources',
                   'Technologies','Logistics','Pharma','Realty','Infrastructure','Telecom',
                   'Materials','Utilities','Insurance','Partners','Group'])
              [1 + floor(random() * 18)::int] AS name,
            (ARRAY['Goldman Sachs Execution','J.P. Morgan Clearing','BlackRock Institutional',
                   'Morgan Stanley Prime','CBRE Global Investors','Citadel Securities',
                   'UBS Custody','Caterpillar Financial','Siemens Capital','Prologis Industrial'])
              [1 + floor(random() * 10)::int] AS supplier,
            (ARRAY['none','none','straight_line','straight_line','declining_balance','units_of_production'])
              [1 + floor(random() * 6)::int] AS depr_method,
            (ARRAY[36, 60, 84, 120, 180, 240, 360])[1 + floor(random() * 7)::int] AS life_months,
            base.qty,
            base.px,
            round((base.qty * base.px * (0.55 + base.r2 * 0.8))::numeric, 4) AS cb,
            round(base.qty * base.px, 4) AS mv,
            base.r1,
            base.r2,
            base.r3,
            base.created,
            base.created::date AS acq_date
          FROM (
            SELECT
              round((1 + random() * 25000)::numeric, 8) AS qty,
              round(exp(random() * 7)::numeric, 8) AS px,
              random() AS r1,
              random() AS r2,
              random() AS r3,
              now() - random() * interval '6 years' AS created
            WHERE g IS NOT NULL
          ) base
        ) s
      `
      console.log(`[${elapsed()}] inserted ${fmt.format(end)} / ${fmt.format(TOTAL)}`)
    }
  } finally {
    // --- Rebuild indexes & stats -------------------------------------------------
    await sql`SET maintenance_work_mem = '1GB'`
    for (const { indexname, indexdef } of indexesToRestore) {
      await sql.unsafe(indexdef)
      console.log(`[${elapsed()}] rebuilt ${indexname}`)
    }
  }
  await sql`VACUUM (ANALYZE) assets`
  await sql`ANALYZE currencies`
  await sql`ANALYZE portfolios`

  if (TRANSACTIONS > 0) await seedTransactions()

  // Refresh dashboard materialized views if the migration has been applied.
  const mvs = await sql<{ name: string }[]>`
    SELECT matviewname AS name
    FROM pg_matviews
    WHERE schemaname = 'public'
      AND matviewname IN ('mv_ledger_summary', 'mv_portfolio_summary')
    ORDER BY matviewname
  `
  for (const { name } of mvs) {
    await sql`REFRESH MATERIALIZED VIEW ${sql(name)}`
    console.log(`[${elapsed()}] refreshed ${name}`)
  }

  const [{ count }] = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM assets`
  const [{ txCount }] = await sql<{ txCount: string }[]>`
    SELECT count(*)::text AS "txCount" FROM transactions
  `
  console.log(
    `[${elapsed()}] done: ${fmt.format(Number(count))} assets, ${fmt.format(Number(txCount))} transactions`,
  )
}

/**
 * Append-only transaction ledger: TRANSACTIONS events spread over 6 years, plus ~0.5%
 * reversing entries (`reverses_id`) to exercise the correction workflow.
 * Inserts never touch the append-only triggers (they only guard UPDATE/DELETE/TRUNCATE),
 * and foreign keys stay enforced.
 */
async function seedTransactions() {
  console.log(`Seeding ${fmt.format(TRANSACTIONS)} transactions`)

  const indexes = await sql<{ indexname: string; indexdef: string }[]>`
    SELECT i.indexname, i.indexdef
    FROM pg_indexes i
    LEFT JOIN pg_constraint c ON c.conname = i.indexname
    WHERE i.schemaname = 'public' AND i.tablename = 'transactions' AND c.oid IS NULL
  `
  for (const { indexname } of indexes) await sql`DROP INDEX IF EXISTS ${sql(indexname)}`
  console.log(`[${elapsed()}] dropped ${indexes.length} transaction indexes`)

  try {
    for (let start = 1; start <= TRANSACTIONS; start += BATCH) {
      const end = Math.min(start + BATCH - 1, TRANSACTIONS)
      await sql`
        INSERT INTO transactions (
          asset_id, type, trade_date, settle_date, quantity, price, amount, currency,
          idempotency_key, memo, created_by, created_at
        )
        SELECT
          a.id,
          s.type::transaction_type,
          s.trade_date,
          CASE WHEN s.type IN ('buy', 'sell') THEN s.trade_date + s.settle_lag
               WHEN s.type = 'revaluation'   THEN NULL
               ELSE s.trade_date END,
          CASE WHEN s.type IN ('buy', 'transfer_in')   THEN s.qty
               WHEN s.type IN ('sell', 'transfer_out') THEN -s.qty
               ELSE 0 END,
          CASE WHEN s.type IN ('buy', 'sell', 'transfer_in', 'transfer_out', 'revaluation')
               THEN s.px END,
          CASE s.type
            WHEN 'buy'          THEN -round(s.qty * s.px, 4)
            WHEN 'sell'         THEN round(s.qty * s.px, 4)
            WHEN 'dividend'     THEN round(s.qty * s.px * 0.02, 4)
            WHEN 'interest'     THEN round(s.qty * s.px * 0.01, 4)
            WHEN 'fee'          THEN -round((1 + s.r1 * 250)::numeric, 4)
            WHEN 'revaluation'  THEN round(s.qty * s.px * ((s.r1 - 0.5) * 0.2)::numeric, 4)
            WHEN 'depreciation' THEN -round(s.qty * s.px * 0.015, 4)
            WHEN 'disposal'     THEN round(s.qty * s.px * 0.85, 4)
            ELSE 0
          END,
          a.currency,
          'seed-' || g,
          CASE WHEN s.r2 < 0.1 THEN 'Batch import ' || to_char(s.trade_date, 'YYYY-MM') END,
          (ARRAY['ops.desk','trading.bot','custody.feed','fund.admin','pm.terminal'])
            [1 + floor(s.r2 * 5)::int],
          s.trade_date + s.r1 * interval '20 hours'
        FROM generate_series(${start}::bigint, ${end}::bigint) g
        CROSS JOIN LATERAL (
          SELECT
            1 + floor(random() * ${TOTAL})::bigint AS asset_id,
            (ARRAY['buy','buy','buy','buy','buy','sell','sell','sell',
                   'dividend','dividend','interest','interest',
                   'fee','fee','transfer_in','transfer_out',
                   'revaluation','depreciation','depreciation','disposal'])
              [1 + floor(random() * 20)::int] AS type,
            current_date - floor(random() * 2190)::int AS trade_date,
            floor(random() * 4)::int AS settle_lag,
            round((1 + random() * 5000)::numeric, 8) AS qty,
            round(exp(random() * 7)::numeric, 8) AS px,
            random() AS r1,
            random() AS r2
          WHERE g IS NOT NULL -- correlate with g so the subquery is evaluated per row
        ) s
        JOIN assets a ON a.id = s.asset_id
      `
      console.log(`[${elapsed()}] inserted ${fmt.format(end)} / ${fmt.format(TRANSACTIONS)} txns`)
    }

    // Reversing entries: negate quantity/amount and point at the original via reverses_id.
    const reversals = await sql`
      INSERT INTO transactions (
        asset_id, type, trade_date, settle_date, quantity, price, amount, currency,
        idempotency_key, reverses_id, memo, created_by, created_at
      )
      SELECT
        t.asset_id,
        t.type,
        r.trade_date,
        r.trade_date,
        -t.quantity,
        t.price,
        -t.amount,
        t.currency,
        'seed-rev-' || t.id,
        t.id,
        (ARRAY['Booking error','Duplicate ticket','Wrong portfolio','Price correction'])
          [1 + floor(random() * 4)::int],
        'ops.control',
        r.trade_date + interval '18 hours'
      FROM transactions t
      CROSS JOIN LATERAL (
        SELECT least(current_date, t.trade_date + (1 + floor(random() * 5))::int) AS trade_date
      ) r
      WHERE t.id % 200 = 7
    `
    console.log(`[${elapsed()}] inserted ${fmt.format(reversals.count)} reversing entries`)
  } finally {
    await sql`SET maintenance_work_mem = '1GB'`
    for (const { indexname, indexdef } of indexes) {
      await sql.unsafe(indexdef)
      console.log(`[${elapsed()}] rebuilt ${indexname}`)
    }
  }
  await sql`VACUUM (ANALYZE) transactions`
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => sql.end())
