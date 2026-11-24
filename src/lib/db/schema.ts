/**
 * Core ledger schema.
 *
 * Conventions
 * - Money and quantities are NUMERIC and surface in TS as decimal strings, never JS floats.
 * - Every row has an internal bigint identity `id` (compact, index-friendly keyset cursor)
 *   and, where exposed externally, a random `public_id` UUID to avoid ID enumeration.
 * - `transactions` and `audit_log` are append-only (enforced by triggers in migrations).
 *   Corrections are made with reversing entries, never UPDATE/DELETE.
 * - Columns use snake_case in SQL (drizzle `casing: 'snake_case'`).
 */
import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  bigint,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const assetClassEnum = pgEnum('asset_class', [
  'equity',
  'fixed_income',
  'cash',
  'commodity',
  'real_estate',
  'crypto',
  'fund',
  'derivative',
])

export const assetStatusEnum = pgEnum('asset_status', [
  'active',
  'suspended',
  'matured',
  'disposed',
])

export const depreciationMethodEnum = pgEnum('depreciation_method', [
  'none',
  'straight_line',
  'declining_balance',
  'units_of_production',
])

export const transactionTypeEnum = pgEnum('transaction_type', [
  'buy',
  'sell',
  'transfer_in',
  'transfer_out',
  'dividend',
  'interest',
  'fee',
  'revaluation',
  'depreciation',
  'disposal',
])

export type AssetClass = (typeof assetClassEnum.enumValues)[number]
export type AssetStatus = (typeof assetStatusEnum.enumValues)[number]
export type DepreciationMethod = (typeof depreciationMethodEnum.enumValues)[number]
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number]

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------

/** Quantity of units held/traded. 20 integer digits, 8 fractional (crypto-safe). */
const quantity = () => numeric({ precision: 28, scale: 8 })
/** Monetary amount in the row's currency. */
const money = () => numeric({ precision: 24, scale: 4 })
/** Unit price; higher scale than money for FX/crypto precision. */
const price = () => numeric({ precision: 24, scale: 8 })
const currencyCode = () => char({ length: 3 })

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export const currencies = pgTable(
  'currencies',
  {
    code: currencyCode().primaryKey(),
    name: varchar({ length: 64 }).notNull(),
    /** ISO 4217 minor units (e.g. USD 2, JPY 0, BHD 3). */
    minorUnits: smallint().notNull().default(2),
  },
  (t) => [
    check('currencies_code_format', sql`${t.code} ~ '^[A-Z]{3}$'`),
    check('currencies_minor_units_range', sql`${t.minorUnits} between 0 and 4`),
  ],
)

export const portfolios = pgTable(
  'portfolios',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    code: varchar({ length: 32 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    baseCurrency: currencyCode()
      .notNull()
      .references(() => currencies.code),
    ...timestamps,
  },
  (t) => [uniqueIndex('portfolios_code_key').on(t.code)],
)

// ---------------------------------------------------------------------------
// Assets (holdings)
// ---------------------------------------------------------------------------

export const assets = pgTable(
  'assets',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid().notNull().defaultRandom(),
    portfolioId: bigint({ mode: 'number' })
      .notNull()
      .references(() => portfolios.id),

    symbol: varchar({ length: 32 }).notNull(),
    isin: char({ length: 12 }),
    name: varchar({ length: 255 }).notNull(),
    assetClass: assetClassEnum().notNull(),
    status: assetStatusEnum().notNull().default('active'),
    currency: currencyCode()
      .notNull()
      .references(() => currencies.code),
    /** ISO 3166-1 alpha-2 country of risk. */
    country: char({ length: 2 }).notNull(),

    quantity: quantity().notNull(),
    /** Acquisition cost (cost basis) in `currency`. */
    costBasis: money().notNull(),
    /**
     * Latest market value in `currency`. Denormalised from the pricing feed so the
     * ledger can be sorted/filtered by value over millions of rows via an index.
     */
    marketValue: money().notNull(),
    valuedAt: timestamp({ withTimezone: true }).notNull(),

    // Acquisition details
    acquisitionDate: date().notNull().defaultNow(),
    supplier: varchar({ length: 128 }),

    // Useful life, depreciation method & accumulated depreciation / amortization
    depreciationMethod: depreciationMethodEnum().notNull().default('none'),
    usefulLifeMonths: integer(),
    salvageValue: money().notNull().default('0'),
    accumulatedDepreciation: money().notNull().default('0'),

    // Disposal or retirement details (populated when status = 'disposed' / 'matured')
    disposalDate: date(),
    disposalValue: money(),
    retirementReason: varchar({ length: 160 }),

    /** Optimistic concurrency token; increment on every update. */
    version: integer().notNull().default(1),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('assets_public_id_key').on(t.publicId),
    check('assets_isin_format', sql`${t.isin} ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'`),
    check('assets_country_format', sql`${t.country} ~ '^[A-Z]{2}$'`),
    check('assets_cost_basis_non_negative', sql`${t.costBasis} >= 0`),
    check(
      'assets_useful_life_positive',
      sql`${t.usefulLifeMonths} is null or ${t.usefulLifeMonths} > 0`,
    ),
    check(
      'assets_salvage_range',
      sql`${t.salvageValue} >= 0 and ${t.salvageValue} <= ${t.costBasis}`,
    ),
    check(
      'assets_accum_depreciation_range',
      sql`${t.accumulatedDepreciation} >= 0 and ${t.accumulatedDepreciation} <= ${t.costBasis}`,
    ),
    check(
      'assets_disposal_after_acquisition',
      sql`${t.disposalDate} is null or ${t.disposalDate} >= ${t.acquisitionDate}`,
    ),
    check(
      'assets_disposal_value_non_negative',
      sql`${t.disposalValue} is null or ${t.disposalValue} >= 0`,
    ),
    check('assets_version_positive', sql`${t.version} > 0`),

    // Keyset pagination: one composite (sort_column, id) index per sortable column.
    index('assets_name_id_idx').on(t.name, t.id),
    index('assets_symbol_id_idx').on(t.symbol, t.id),
    index('assets_market_value_id_idx').on(t.marketValue, t.id),
    index('assets_updated_at_id_idx').on(t.updatedAt, t.id),

    // Filters / foreign keys.
    index('assets_portfolio_id_idx').on(t.portfolioId),
    index('assets_asset_class_idx').on(t.assetClass),
    index('assets_status_idx').on(t.status),
    index('assets_currency_idx').on(t.currency),
    index('assets_depreciation_method_idx').on(t.depreciationMethod),
    index('assets_isin_idx').on(t.isin),

    // Substring search (ILIKE '%q%') via pg_trgm.
    index('assets_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
    index('assets_symbol_trgm_idx').using('gin', t.symbol.op('gin_trgm_ops')),
  ],
)

// ---------------------------------------------------------------------------
// Transactions (append-only)
// ---------------------------------------------------------------------------

export const transactions = pgTable(
  'transactions',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid().notNull().defaultRandom(),
    assetId: bigint({ mode: 'number' })
      .notNull()
      .references(() => assets.id),
    type: transactionTypeEnum().notNull(),
    tradeDate: date().notNull(),
    settleDate: date(),
    /** Signed: positive increases the position, negative decreases it. */
    quantity: quantity().notNull(),
    price: price(),
    /** Signed cash amount in `currency`. */
    amount: money().notNull(),
    currency: currencyCode()
      .notNull()
      .references(() => currencies.code),
    /** Client-supplied key making writes safe to retry. */
    idempotencyKey: varchar({ length: 64 }).notNull(),
    /** Set when this row reverses (cancels) an earlier transaction. */
    reversesId: bigint({ mode: 'number' }).references((): AnyPgColumn => transactions.id),
    memo: text(),
    createdBy: varchar({ length: 128 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('transactions_public_id_key').on(t.publicId),
    uniqueIndex('transactions_idempotency_key_key').on(t.idempotencyKey),
    // A transaction can be reversed at most once.
    uniqueIndex('transactions_reverses_id_key').on(t.reversesId),
    check(
      'transactions_settle_after_trade',
      sql`${t.settleDate} is null or ${t.settleDate} >= ${t.tradeDate}`,
    ),
    check('transactions_not_self_reversing', sql`${t.reversesId} is distinct from ${t.id}`),
    
    index('transactions_asset_trade_date_idx').on(t.assetId, t.tradeDate, t.id),
    index('transactions_trade_date_id_idx').on(t.tradeDate, t.id),
    // Keyset pagination within the common ledger filters (newest-first by trade date).
    index('transactions_type_trade_date_id_idx').on(t.type, t.tradeDate, t.id),
    index('transactions_currency_trade_date_id_idx').on(t.currency, t.tradeDate, t.id),
    // Small partial index: reversal entries are rare, so "reversals only" stays instant.
    index('transactions_reversals_trade_date_id_idx')
      .on(t.tradeDate, t.id)
      .where(sql`${t.reversesId} is not null`),
  ],
)

// ---------------------------------------------------------------------------
// Audit log (append-only)
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actor: varchar({ length: 128 }).notNull(),
    action: varchar({ length: 32 }).notNull(),
    entityType: varchar({ length: 64 }).notNull(),
    entityId: varchar({ length: 64 }).notNull(),
    before: jsonb(),
    after: jsonb(),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entityType, t.entityId, t.occurredAt),
    index('audit_log_occurred_at_idx').on(t.occurredAt),
  ],
)
