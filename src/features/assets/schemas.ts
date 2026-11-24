import { z } from 'zod'

export const ASSET_CLASSES = [
  'equity',
  'fixed_income',
  'cash',
  'commodity',
  'real_estate',
  'crypto',
  'fund',
  'derivative',
] as const

export type AssetClassValue = (typeof ASSET_CLASSES)[number]

export const ASSET_CLASS_LABELS: Record<AssetClassValue, string> = {
  equity: 'Equity',
  fixed_income: 'Fixed Income',
  cash: 'Cash',
  commodity: 'Commodity',
  real_estate: 'Real Estate',
  crypto: 'Crypto',
  fund: 'Fund',
  derivative: 'Derivative',
}

export const ASSET_STATUSES = ['active', 'suspended', 'matured', 'disposed'] as const

export type AssetStatusValue = (typeof ASSET_STATUSES)[number]

export const ASSET_STATUS_LABELS: Record<AssetStatusValue, string> = {
  active: 'Active',
  suspended: 'Suspended',
  matured: 'Matured',
  disposed: 'Disposed',
}

export const DEPRECIATION_METHODS = [
  'none',
  'straight_line',
  'declining_balance',
  'units_of_production',
] as const

export type DepreciationMethodValue = (typeof DEPRECIATION_METHODS)[number]

export const DEPRECIATION_METHOD_LABELS: Record<DepreciationMethodValue, string> = {
  none: 'Non-Depreciable',
  straight_line: 'Straight-Line',
  declining_balance: 'Declining Balance',
  units_of_production: 'Units of Production',
}

export const SORT_COLUMNS = ['name', 'symbol', 'marketValue', 'updatedAt'] as const
export type AssetSortColumn = (typeof SORT_COLUMNS)[number]

export const SORT_DIRS = ['asc', 'desc'] as const
export type SortDirection = (typeof SORT_DIRS)[number]

export const CURSOR_DIRS = ['next', 'prev'] as const
export type CursorDirection = (typeof CURSOR_DIRS)[number]

export const PAGE_SIZES = [25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

export const VIEW_MODES = ['paginated', 'virtual'] as const
export type AssetViewMode = (typeof VIEW_MODES)[number]

export const DEFAULT_SORT: AssetSortColumn = 'marketValue'
export const DEFAULT_DIR: SortDirection = 'desc'
export const DEFAULT_PAGE_SIZE: PageSize = 50
export const DEFAULT_VIEW_MODE: AssetViewMode = 'paginated'

export interface AssetListQuery {
  q?: string
  assetClass?: AssetClassValue
  status?: AssetStatusValue
  depreciationMethod?: DepreciationMethodValue
  currency?: string
  portfolioId?: number
  sort: AssetSortColumn
  dir: SortDirection
  cursor?: string
  cursorDir: CursorDirection
  pageSize: PageSize
  view: AssetViewMode
}

export interface SerializedAssetListItem {
  id: number
  publicId: string
  symbol: string
  isin: string | null
  name: string
  assetClass: AssetClassValue
  status: AssetStatusValue
  currency: string
  currencyMinorUnits: number
  country: string
  portfolioId: number
  portfolioCode: string
  portfolioName: string
  quantity: string
  costBasis: string
  marketValue: string
  valuedAt: string
  acquisitionDate: string
  supplier: string | null
  depreciationMethod: DepreciationMethodValue
  usefulLifeMonths: number | null
  salvageValue: string
  accumulatedDepreciation: string
  disposalDate: string | null
  disposalValue: string | null
  retirementReason: string | null
  updatedAt: string
}

export type RawSearchParams = Record<string, string | string[] | undefined>

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

const assetClassSchema = z.enum(ASSET_CLASSES)
const assetStatusSchema = z.enum(ASSET_STATUSES)
const depreciationMethodSchema = z.enum(DEPRECIATION_METHODS)
const currencySchema = z.string().regex(/^[A-Z]{3}$/)
const portfolioIdSchema = z.coerce.number().int().positive()
const sortSchema = z.enum(SORT_COLUMNS)
const dirSchema = z.enum(SORT_DIRS)
const cursorDirSchema = z.enum(CURSOR_DIRS)
const viewModeSchema = z.enum(VIEW_MODES)

/**
 * Parse URL searchParams into a validated AssetListQuery.
 * Invalid individual parameters fall back to defaults instead of throwing,
 * so hand-edited or stale bookmarked URLs degrade gracefully.
 */
export function parseAssetSearchParams(raw: RawSearchParams): AssetListQuery {
  const rawQ = firstParam(raw.q)?.trim()
  const q = rawQ && rawQ.length > 0 ? rawQ.slice(0, 100) : undefined

  const assetClassRes = assetClassSchema.safeParse(firstParam(raw.assetClass))
  const statusRes = assetStatusSchema.safeParse(firstParam(raw.status))
  const deprRes = depreciationMethodSchema.safeParse(firstParam(raw.depreciationMethod))
  const currencyRes = currencySchema.safeParse(firstParam(raw.currency)?.toUpperCase())
  const portfolioRes = portfolioIdSchema.safeParse(firstParam(raw.portfolioId))
  const sortRes = sortSchema.safeParse(firstParam(raw.sort))
  const dirRes = dirSchema.safeParse(firstParam(raw.dir))
  const cursorDirRes = cursorDirSchema.safeParse(firstParam(raw.cursorDir))
  const viewRes = viewModeSchema.safeParse(firstParam(raw.view))

  const rawPageSize = Number(firstParam(raw.pageSize))
  const pageSize: PageSize = (PAGE_SIZES as readonly number[]).includes(rawPageSize)
    ? (rawPageSize as PageSize)
    : DEFAULT_PAGE_SIZE

  const rawCursor = firstParam(raw.cursor)?.trim()
  const cursor =
    rawCursor && rawCursor.length > 0 && rawCursor.length <= 512 ? rawCursor : undefined

  return {
    q,
    assetClass: assetClassRes.success ? assetClassRes.data : undefined,
    status: statusRes.success ? statusRes.data : undefined,
    depreciationMethod: deprRes.success ? deprRes.data : undefined,
    currency: currencyRes.success ? currencyRes.data : undefined,
    portfolioId: portfolioRes.success ? portfolioRes.data : undefined,
    sort: sortRes.success ? sortRes.data : DEFAULT_SORT,
    dir: dirRes.success ? dirRes.data : DEFAULT_DIR,
    cursor,
    cursorDir: cursorDirRes.success ? cursorDirRes.data : 'next',
    pageSize,
    view: viewRes.success ? viewRes.data : DEFAULT_VIEW_MODE,
  }
}

export function hasActiveFilters(query: AssetListQuery): boolean {
  return Boolean(
    query.q ||
    query.assetClass ||
    query.status ||
    query.depreciationMethod ||
    query.currency ||
    query.portfolioId !== undefined,
  )
}

/**
 * Build a clean `/assets` URL from a query object, omitting default values.
 */
export function buildAssetListHref(query: Partial<AssetListQuery>): string {
  const params = new URLSearchParams()

  if (query.q) params.set('q', query.q)
  if (query.assetClass) params.set('assetClass', query.assetClass)
  if (query.status) params.set('status', query.status)
  if (query.depreciationMethod) params.set('depreciationMethod', query.depreciationMethod)
  if (query.currency) params.set('currency', query.currency)
  if (query.portfolioId !== undefined) params.set('portfolioId', String(query.portfolioId))
  if (query.sort && query.sort !== DEFAULT_SORT) params.set('sort', query.sort)
  if (query.dir && query.dir !== DEFAULT_DIR) params.set('dir', query.dir)
  if (query.pageSize && query.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set('pageSize', String(query.pageSize))
  }
  if (query.view && query.view !== DEFAULT_VIEW_MODE) {
    params.set('view', query.view)
  }
  if (query.cursor) {
    params.set('cursor', query.cursor)
    if (query.cursorDir === 'prev') params.set('cursorDir', 'prev')
  }

  const qs = params.toString()
  return qs ? `/assets?${qs}` : '/assets'
}

// ---------------------------------------------------------------------------
// Keyset cursor codec
// ---------------------------------------------------------------------------

const cursorPayloadSchema = z.object({
  v: z.string(),
  id: z.number().int().positive(),
})

export type AssetCursor = z.infer<typeof cursorPayloadSchema>

export function encodeAssetCursor(cursor: AssetCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeAssetCursor(raw: string | undefined): AssetCursor | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    const result = cursorPayloadSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}
