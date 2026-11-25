import 'server-only'
import { and, asc, desc, eq, gte, ilike, isNotNull, lte, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db'
import { assets, currencies, transactions } from '@/lib/db/schema'
import {
  type TransactionListQuery,
  type TransactionTypeValue,
  UUID_REGEX,
  decodeTxCursor,
  encodeTxCursor,
  hasActiveTxFilters,
} from './schemas'

export interface TransactionListItem {
  id: number
  publicId: string
  type: TransactionTypeValue
  tradeDate: string
  settleDate: string | null
  quantity: string
  price: string | null
  amount: string
  currency: string
  currencyMinorUnits: number
  memo: string | null
  createdBy: string
  assetPublicId: string
  assetSymbol: string
  assetName: string
  /** Set when this row is a reversing entry. */
  reversesPublicId: string | null
  /** Set when a later entry has reversed this row. */
  reversedByPublicId: string | null
}

export interface TransactionListResult {
  items: TransactionListItem[]
  hasNextPage: boolean
  hasPrevPage: boolean
  nextCursor: string | null
  prevCursor: string | null
  approxTotal: number | null
  isFiltered: boolean
  queryMs: number
}

const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

// Self-joins resolving the reversal relationship in both directions.
const original = alias(transactions, 'original_tx')
const reversal = alias(transactions, 'reversal_tx')

async function getApproxTransactionCount(): Promise<number | null> {
  const result = await db().execute<{ estimate: string | number | null }>(
    sql`select reltuples::bigint as estimate from pg_class where relname = 'transactions'`,
  )
  const num = Number(result[0]?.estimate)
  return Number.isFinite(num) && num >= 0 ? num : null
}

/**
 * Keyset-paginated transaction ledger ordered by `(trade_date, id)`.
 *
 * Each filter has a matching `(filter_col, trade_date, id)` index, so Postgres walks
 * the index in order and stops after `pageSize + 1` rows. The reversal look-ups are
 * unique-index probes, so they add a constant cost per displayed row.
 */
export async function listTransactions(
  query: TransactionListQuery,
): Promise<TransactionListResult> {
  const start = performance.now()
  const isFiltered = hasActiveTxFilters(query)
  const cursor = decodeTxCursor(query.cursor)
  const isPrev = Boolean(cursor && query.cursorDir === 'prev')
  const effectiveDir: 'asc' | 'desc' = isPrev ? (query.dir === 'asc' ? 'desc' : 'asc') : query.dir
  const limit = query.pageSize

  const conditions: SQL[] = []

  if (query.type) conditions.push(eq(transactions.type, query.type))
  if (query.currency) conditions.push(eq(transactions.currency, query.currency))
  if (query.from) conditions.push(gte(transactions.tradeDate, query.from))
  if (query.to) conditions.push(lte(transactions.tradeDate, query.to))
  if (query.asset) conditions.push(eq(assets.publicId, query.asset))

  if (query.reversal === 'reversals') conditions.push(isNotNull(transactions.reversesId))
  if (query.reversal === 'reversed') conditions.push(isNotNull(reversal.id))

  if (query.q) {
    const upper = query.q.toUpperCase()
    if (UUID_REGEX.test(query.q)) {
      const cond = or(eq(transactions.publicId, query.q), eq(assets.publicId, query.q))
      if (cond) conditions.push(cond)
    } else if (ISIN_REGEX.test(upper)) {
      conditions.push(eq(assets.isin, upper))
    } else {
      const tokens = query.q.split(/\s+/).filter(Boolean).slice(0, 5)
      for (const token of tokens) {
        const tokenPattern = `%${escapeLike(token)}%`
        const cond =
          token.length >= 4
            ? or(
                ilike(assets.symbol, tokenPattern),
                ilike(assets.name, tokenPattern),
                sql`${token} <% ${assets.name}`,
              )
            : or(
                ilike(assets.symbol, tokenPattern),
                ilike(assets.name, tokenPattern),
              )
        if (cond) conditions.push(cond)
      }
    }
  }

  let appliedCursor = false
  if (cursor) {
    const op = effectiveDir === 'asc' ? sql.raw('>') : sql.raw('<')
    conditions.push(
      sql`(${transactions.tradeDate}, ${transactions.id}) ${op} (${cursor.d}::date, ${cursor.id})`,
    )
    appliedCursor = true
  }

  const dirFn = effectiveDir === 'asc' ? asc : desc

  const rowsPromise = db()
    .select({
      id: transactions.id,
      publicId: transactions.publicId,
      type: transactions.type,
      tradeDate: transactions.tradeDate,
      settleDate: transactions.settleDate,
      quantity: transactions.quantity,
      price: transactions.price,
      amount: transactions.amount,
      currency: transactions.currency,
      currencyMinorUnits: currencies.minorUnits,
      memo: transactions.memo,
      createdBy: transactions.createdBy,
      assetPublicId: assets.publicId,
      assetSymbol: assets.symbol,
      assetName: assets.name,
      reversesPublicId: original.publicId,
      reversedByPublicId: reversal.publicId,
    })
    .from(transactions)
    .innerJoin(assets, eq(transactions.assetId, assets.id))
    .innerJoin(currencies, eq(transactions.currency, currencies.code))
    .leftJoin(original, eq(transactions.reversesId, original.id))
    .leftJoin(reversal, eq(reversal.reversesId, transactions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(dirFn(transactions.tradeDate), dirFn(transactions.id))
    .limit(limit + 1)

  const [rawRows, approxTotal] = await Promise.all([
    rowsPromise,
    isFiltered ? Promise.resolve(null) : getApproxTransactionCount(),
  ])

  const hasMore = rawRows.length > limit
  const items = hasMore ? rawRows.slice(0, limit) : rawRows
  if (isPrev) items.reverse()

  const hasNextPage = isPrev ? items.length > 0 : hasMore
  const hasPrevPage = isPrev ? hasMore : appliedCursor

  const first = items[0]
  const last = items[items.length - 1]

  return {
    items,
    hasNextPage,
    hasPrevPage,
    nextCursor: hasNextPage && last ? encodeTxCursor({ d: last.tradeDate, id: last.id }) : null,
    prevCursor: hasPrevPage && first ? encodeTxCursor({ d: first.tradeDate, id: first.id }) : null,
    approxTotal,
    isFiltered,
    queryMs: Math.max(1, Math.round(performance.now() - start)),
  }
}
