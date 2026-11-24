import 'server-only'
import { asc, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { currencies } from '@/lib/db/schema'
import { LEDGER_SETTINGS_COOKIE, type LedgerSettings, parseLedgerSettingsCookie } from './schemas'

export async function getLedgerSettings(): Promise<LedgerSettings> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(LEDGER_SETTINGS_COOKIE)?.value
  return parseLedgerSettingsCookie(raw)
}

export interface TableStorageStat {
  tableName: string
  estimatedRows: number
  tableBytes: number
  indexBytes: number
  totalBytes: number
}

export interface MatViewStat {
  viewName: string
  isPopulated: boolean
  totalBytes: number
}

export interface DatabaseDiagnostics {
  databaseBytes: number
  pgVersion: string
  tables: TableStorageStat[]
  matViews: MatViewStat[]
  currencies: { code: string; name: string; minorUnits: number }[]
  queryMs: number
}

interface RawTableRow {
  table_name: string
  estimated_rows: string | number
  table_bytes: string | number
  index_bytes: string | number
  total_bytes: string | number
  [key: string]: unknown
}

interface RawMatViewRow {
  view_name: string
  is_populated: boolean
  total_bytes: string | number
  [key: string]: unknown
}

interface RawDbMetaRow {
  db_bytes: string | number
  pg_version: string
  [key: string]: unknown
}

export async function getDatabaseDiagnostics(): Promise<DatabaseDiagnostics> {
  const start = performance.now()
  const database = db()

  const [metaRows, tableRows, matViewRows, currencyRows] = await Promise.all([
    database.execute<RawDbMetaRow>(sql`
      SELECT
        pg_database_size(current_database())::bigint AS db_bytes,
        current_setting('server_version') AS pg_version
    `),
    database.execute<RawTableRow>(sql`
      SELECT
        c.relname AS table_name,
        greatest(0, c.reltuples::bigint) AS estimated_rows,
        pg_table_size(c.oid)::bigint AS table_bytes,
        pg_indexes_size(c.oid)::bigint AS index_bytes,
        pg_total_relation_size(c.oid)::bigint AS total_bytes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname IN ('assets', 'transactions', 'portfolios', 'currencies', 'audit_log')
      ORDER BY pg_total_relation_size(c.oid) DESC
    `),
    database.execute<RawMatViewRow>(sql`
      SELECT
        m.matviewname AS view_name,
        m.ispopulated AS is_populated,
        pg_total_relation_size(c.oid)::bigint AS total_bytes
      FROM pg_matviews m
      JOIN pg_class c ON c.relname = m.matviewname
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = m.schemaname
      WHERE m.schemaname = 'public'
      ORDER BY m.matviewname
    `),
    database
      .select({
        code: currencies.code,
        name: currencies.name,
        minorUnits: currencies.minorUnits,
      })
      .from(currencies)
      .orderBy(asc(currencies.code)),
  ])

  const meta = metaRows[0]

  return {
    databaseBytes: Number(meta?.db_bytes ?? 0),
    pgVersion: meta?.pg_version ?? '17',
    tables: tableRows.map((r) => ({
      tableName: r.table_name,
      estimatedRows: Number(r.estimated_rows),
      tableBytes: Number(r.table_bytes),
      indexBytes: Number(r.index_bytes),
      totalBytes: Number(r.total_bytes),
    })),
    matViews: matViewRows.map((m) => ({
      viewName: m.view_name,
      isPopulated: Boolean(m.is_populated),
      totalBytes: Number(m.total_bytes),
    })),
    currencies: currencyRows,
    queryMs: Math.max(1, Math.round(performance.now() - start)),
  }
}
