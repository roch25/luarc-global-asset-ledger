'use server'

import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import {
  DEFAULT_LEDGER_SETTINGS,
  LEDGER_SETTINGS_COOKIE,
  type LedgerSettings,
  validateLedgerSettings,
} from './schemas'

export async function saveLedgerSettingsAction(
  input: Partial<LedgerSettings>,
): Promise<{ ok: boolean; settings: LedgerSettings }> {
  const settings = validateLedgerSettings(input)
  const cookieStore = await cookies()

  cookieStore.set(LEDGER_SETTINGS_COOKIE, JSON.stringify(settings), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  revalidatePath('/', 'layout')
  return { ok: true, settings }
}

export async function resetLedgerSettingsAction(): Promise<{
  ok: boolean
  settings: LedgerSettings
}> {
  const cookieStore = await cookies()
  cookieStore.delete(LEDGER_SETTINGS_COOKIE)

  revalidatePath('/', 'layout')
  return { ok: true, settings: DEFAULT_LEDGER_SETTINGS }
}

export async function refreshMaterializedViewsAction(): Promise<{
  ok: boolean
  durationMs: number
  error?: string
}> {
  const start = performance.now()
  try {
    const database = db()
    await database.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ledger_summary`)
    await database.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_portfolio_summary`)
    revalidatePath('/')
    revalidatePath('/reports')
    revalidatePath('/settings')
    return {
      ok: true,
      durationMs: Math.max(1, Math.round(performance.now() - start)),
    }
  } catch (err) {
    console.error('[refreshMaterializedViewsAction] failed:', err)
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      error: (err as Error).message || 'Failed to refresh materialized views',
    }
  }
}
