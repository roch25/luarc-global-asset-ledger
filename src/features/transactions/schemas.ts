import { z } from 'zod'

export const TRANSACTION_TYPES = [
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
] as const

export type TransactionTypeValue = (typeof TRANSACTION_TYPES)[number]

export const TRANSACTION_TYPE_LABELS: Record<TransactionTypeValue, string> = {
  buy: 'Buy',
  sell: 'Sell',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  dividend: 'Dividend',
  interest: 'Interest',
  fee: 'Fee',
  revaluation: 'Revaluation',
  depreciation: 'Depreciation',
  disposal: 'Disposal',
}

/** `reversals` = correcting entries; `reversed` = originals that have been cancelled. */
export const REVERSAL_FILTERS = ['all', 'reversals', 'reversed'] as const
export type ReversalFilter = (typeof REVERSAL_FILTERS)[number]

export const REVERSAL_FILTER_LABELS: Record<ReversalFilter, string> = {
  all: 'All entries',
  reversals: 'Reversing entries',
  reversed: 'Reversed originals',
}

export const TX_PAGE_SIZES = [25, 50, 100] as const
export type TxPageSize = (typeof TX_PAGE_SIZES)[number]

export const DEFAULT_TX_PAGE_SIZE: TxPageSize = 50

export interface TransactionListQuery {
  /** Asset symbol prefix, exact ISIN, or a transaction UUID. */
  q?: string
  /** Asset public UUID (deep link from the asset ledger). */
  asset?: string
  type?: TransactionTypeValue
  currency?: string
  reversal: ReversalFilter
  /** Inclusive trade-date range, YYYY-MM-DD. */
  from?: string
  to?: string
  dir: 'asc' | 'desc'
  cursor?: string
  cursorDir: 'next' | 'prev'
  pageSize: TxPageSize
}

export type RawSearchParams = Record<string, string | string[] | undefined>

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isoDateSchema = z.iso.date()

function parseIsoDate(raw: string | undefined): string | undefined {
  const res = isoDateSchema.safeParse(raw)
  return res.success ? res.data : undefined
}

export function parseTransactionSearchParams(raw: RawSearchParams): TransactionListQuery {
  const rawQ = firstParam(raw.q)?.trim()
  const q = rawQ ? rawQ.slice(0, 64) : undefined

  const rawAsset = firstParam(raw.asset)?.trim()
  const asset = rawAsset && UUID_REGEX.test(rawAsset) ? rawAsset.toLowerCase() : undefined

  const typeRes = z.enum(TRANSACTION_TYPES).safeParse(firstParam(raw.type))
  const currencyRes = z
    .string()
    .regex(/^[A-Z]{3}$/)
    .safeParse(firstParam(raw.currency)?.toUpperCase())
  const reversalRes = z.enum(REVERSAL_FILTERS).safeParse(firstParam(raw.reversal))

  let from = parseIsoDate(firstParam(raw.from))
  let to = parseIsoDate(firstParam(raw.to))
  // Swap an inverted range instead of returning an empty result.
  if (from && to && from > to) [from, to] = [to, from]

  const rawPageSize = Number(firstParam(raw.pageSize))
  const pageSize = (TX_PAGE_SIZES as readonly number[]).includes(rawPageSize)
    ? (rawPageSize as TxPageSize)
    : DEFAULT_TX_PAGE_SIZE

  const rawCursor = firstParam(raw.cursor)?.trim()

  return {
    q,
    asset,
    type: typeRes.success ? typeRes.data : undefined,
    currency: currencyRes.success ? currencyRes.data : undefined,
    reversal: reversalRes.success ? reversalRes.data : 'all',
    from,
    to,
    dir: firstParam(raw.dir) === 'asc' ? 'asc' : 'desc',
    cursor: rawCursor && rawCursor.length <= 256 ? rawCursor : undefined,
    cursorDir: firstParam(raw.cursorDir) === 'prev' ? 'prev' : 'next',
    pageSize,
  }
}

export function hasActiveTxFilters(query: TransactionListQuery): boolean {
  return Boolean(
    query.q ||
    query.asset ||
    query.type ||
    query.currency ||
    query.reversal !== 'all' ||
    query.from ||
    query.to,
  )
}

export function buildTransactionListHref(query: Partial<TransactionListQuery>): string {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.asset) params.set('asset', query.asset)
  if (query.type) params.set('type', query.type)
  if (query.currency) params.set('currency', query.currency)
  if (query.reversal && query.reversal !== 'all') params.set('reversal', query.reversal)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  if (query.dir === 'asc') params.set('dir', 'asc')
  if (query.pageSize && query.pageSize !== DEFAULT_TX_PAGE_SIZE) {
    params.set('pageSize', String(query.pageSize))
  }
  if (query.cursor) {
    params.set('cursor', query.cursor)
    if (query.cursorDir === 'prev') params.set('cursorDir', 'prev')
  }
  const qs = params.toString()
  return qs ? `/transactions?${qs}` : '/transactions'
}

// ---------------------------------------------------------------------------
// Keyset cursor codec: (trade_date, id)
// ---------------------------------------------------------------------------

const txCursorSchema = z.object({
  d: z.iso.date(),
  id: z.number().int().positive(),
})

export type TransactionCursor = z.infer<typeof txCursorSchema>

export function encodeTxCursor(cursor: TransactionCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeTxCursor(raw: string | undefined): TransactionCursor | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    const result = txCursorSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}
