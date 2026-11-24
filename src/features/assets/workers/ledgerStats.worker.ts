/**
 * Dedicated Web Worker for off-main-thread financial aggregations over large
 * loaded asset buffers (thousands of rows) using exact BigInt scaled arithmetic.
 */
import { computeUnrealizedPnl, formatCompactMoney, parseDecimalToScaled } from '@/lib/format'
import type { AssetStatusValue, SerializedAssetListItem } from '../schemas'

export interface WorkerCurrencyRollup {
  code: string
  minorUnits: number
  count: number
  marketValueCompact: string
  pnlAmountCompact: string
  pnlPercent: string | null
  pnlDirection: 'positive' | 'negative' | 'flat'
}

export interface WorkerPerformer {
  symbol: string
  name: string
  currency: string
  pnlPercent: string
  bps: number
}

export interface LedgerWorkerStats {
  totalLoaded: number
  statusCounts: Record<AssetStatusValue, number>
  topCurrencies: WorkerCurrencyRollup[]
  bestPerformer: WorkerPerformer | null
  worstPerformer: WorkerPerformer | null
  workerMs: number
}

export interface LedgerWorkerRequest {
  requestId: number
  items: SerializedAssetListItem[]
}

export interface LedgerWorkerResponse {
  requestId: number
  stats: LedgerWorkerStats
}

const ZERO = BigInt(0)
const TWO = BigInt(2)
const BPS_SCALE = BigInt(10_000)

function formatScaled4Plain(val: bigint): string {
  const neg = val < ZERO
  const abs = neg ? -val : val
  const s = abs.toString().padStart(5, '0')
  const intPart = s.slice(0, s.length - 4)
  const fracPart = s.slice(s.length - 4)
  return `${neg ? '-' : ''}${intPart}.${fracPart}`
}

function computeStats(items: SerializedAssetListItem[]): LedgerWorkerStats {
  const start = performance.now()

  const statusCounts: Record<AssetStatusValue, number> = {
    active: 0,
    suspended: 0,
    matured: 0,
    disposed: 0,
  }

  const byCurrency = new Map<
    string,
    { minorUnits: number; count: number; mv: bigint; cb: bigint }
  >()

  let bestPerformer: WorkerPerformer | null = null
  let worstPerformer: WorkerPerformer | null = null

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1

    const mv = parseDecimalToScaled(item.marketValue, 4)
    const cb = parseDecimalToScaled(item.costBasis, 4)

    const agg = byCurrency.get(item.currency)
    if (agg) {
      agg.count += 1
      agg.mv += mv
      agg.cb += cb
    } else {
      byCurrency.set(item.currency, {
        minorUnits: item.currencyMinorUnits,
        count: 1,
        mv,
        cb,
      })
    }

    if (cb > ZERO) {
      const diff = mv - cb
      const numerator = diff * BPS_SCALE
      const halfCb = cb / TWO
      const bpsBig = diff >= ZERO ? (numerator + halfCb) / cb : (numerator - halfCb) / cb
      const bps = Number(bpsBig)

      if (bestPerformer === null || bps > bestPerformer.bps) {
        const sign = bps > 0 ? '+' : bps < 0 ? '-' : ''
        const absBps = Math.abs(bps)
        bestPerformer = {
          symbol: item.symbol,
          name: item.name,
          currency: item.currency,
          pnlPercent: `${sign}${(absBps / 100).toFixed(2)}%`,
          bps,
        }
      }
      if (worstPerformer === null || bps < worstPerformer.bps) {
        const sign = bps > 0 ? '+' : bps < 0 ? '-' : ''
        const absBps = Math.abs(bps)
        worstPerformer = {
          symbol: item.symbol,
          name: item.name,
          currency: item.currency,
          pnlPercent: `${sign}${(absBps / 100).toFixed(2)}%`,
          bps,
        }
      }
    }
  }

  const topCurrencies: WorkerCurrencyRollup[] = [...byCurrency.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([code, agg]) => {
      const mvPlain = formatScaled4Plain(agg.mv)
      const cbPlain = formatScaled4Plain(agg.cb)
      const diffPlain = formatScaled4Plain(agg.mv - agg.cb)
      const pnl = computeUnrealizedPnl(mvPlain, cbPlain, agg.minorUnits)

      return {
        code,
        minorUnits: agg.minorUnits,
        count: agg.count,
        marketValueCompact: formatCompactMoney(mvPlain, code, agg.minorUnits),
        pnlAmountCompact: formatCompactMoney(diffPlain, code, agg.minorUnits, { showPlus: true }),
        pnlPercent: pnl.percent,
        pnlDirection: pnl.direction,
      }
    })

  return {
    totalLoaded: items.length,
    statusCounts,
    topCurrencies,
    bestPerformer,
    worstPerformer,
    workerMs: Number(performance.now() - start),
  }
}

self.addEventListener('message', (event: MessageEvent<LedgerWorkerRequest>) => {
  const { requestId, items } = event.data
  const stats = computeStats(items)
  const response: LedgerWorkerResponse = { requestId, stats }
  self.postMessage(response)
})
