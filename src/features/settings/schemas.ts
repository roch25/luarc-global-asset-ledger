import { z } from 'zod'
import {
  PAGE_SIZES,
  SORT_COLUMNS,
  SORT_DIRS,
  VIEW_MODES,
  type AssetSortColumn,
  type AssetViewMode,
  type PageSize,
  type SortDirection,
} from '@/features/assets/schemas'

export const LEDGER_SETTINGS_COOKIE = 'gal_settings'

export const EXPORT_ROW_CAPS = [10_000, 50_000, 100_000, 250_000] as const
export type ExportRowCap = (typeof EXPORT_ROW_CAPS)[number]

export const NUMBER_DISPLAY_MODES = ['compact', 'full'] as const
export type NumberDisplayMode = (typeof NUMBER_DISPLAY_MODES)[number]

export interface LedgerSettings {
  defaultCurrency: string
  numberDisplay: NumberDisplayMode
  defaultAssetView: AssetViewMode
  defaultPageSize: PageSize
  defaultAssetSort: AssetSortColumn
  defaultAssetDir: SortDirection
  defaultExportMaxRows: ExportRowCap
}

export const DEFAULT_LEDGER_SETTINGS: LedgerSettings = {
  defaultCurrency: 'INR',
  numberDisplay: 'compact',
  defaultAssetView: 'paginated',
  defaultPageSize: 50,
  defaultAssetSort: 'marketValue',
  defaultAssetDir: 'desc',
  defaultExportMaxRows: 50_000,
}

const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/)
const numberDisplaySchema = z.enum(NUMBER_DISPLAY_MODES)
const viewModeSchema = z.enum(VIEW_MODES)
const sortColumnSchema = z.enum(SORT_COLUMNS)
const sortDirSchema = z.enum(SORT_DIRS)

export function validateLedgerSettings(input: Partial<LedgerSettings>): LedgerSettings {
  const cur = currencyCodeSchema.safeParse(input.defaultCurrency?.toUpperCase())
  const numDisp = numberDisplaySchema.safeParse(input.numberDisplay)
  const view = viewModeSchema.safeParse(input.defaultAssetView)
  const sort = sortColumnSchema.safeParse(input.defaultAssetSort)
  const dir = sortDirSchema.safeParse(input.defaultAssetDir)

  const pageSize: PageSize = (PAGE_SIZES as readonly number[]).includes(
    Number(input.defaultPageSize),
  )
    ? (Number(input.defaultPageSize) as PageSize)
    : DEFAULT_LEDGER_SETTINGS.defaultPageSize

  const exportCap: ExportRowCap = (EXPORT_ROW_CAPS as readonly number[]).includes(
    Number(input.defaultExportMaxRows),
  )
    ? (Number(input.defaultExportMaxRows) as ExportRowCap)
    : DEFAULT_LEDGER_SETTINGS.defaultExportMaxRows

  return {
    defaultCurrency: cur.success ? cur.data : DEFAULT_LEDGER_SETTINGS.defaultCurrency,
    numberDisplay: numDisp.success ? numDisp.data : DEFAULT_LEDGER_SETTINGS.numberDisplay,
    defaultAssetView: view.success ? view.data : DEFAULT_LEDGER_SETTINGS.defaultAssetView,
    defaultPageSize: pageSize,
    defaultAssetSort: sort.success ? sort.data : DEFAULT_LEDGER_SETTINGS.defaultAssetSort,
    defaultAssetDir: dir.success ? dir.data : DEFAULT_LEDGER_SETTINGS.defaultAssetDir,
    defaultExportMaxRows: exportCap,
  }
}

export function parseLedgerSettingsCookie(raw: string | undefined): LedgerSettings {
  if (!raw) return DEFAULT_LEDGER_SETTINGS
  try {
    const parsed = JSON.parse(raw) as Partial<LedgerSettings>
    return validateLedgerSettings(parsed)
  } catch {
    return DEFAULT_LEDGER_SETTINGS
  }
}
