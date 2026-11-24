/**
 * Exact decimal-string formatting and arithmetic for financial values.
 *
 * PostgreSQL NUMERIC columns arrive from Drizzle as decimal strings. We keep
 * them out of IEEE-754 floating point by scaling into BigInt integers.
 */

const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)
const TEN = BigInt(10)

function pow10(exp: number): bigint {
  let result = ONE
  for (let i = 0; i < exp; i++) result *= TEN
  return result
}

/**
 * Parse a decimal string (e.g. "-1234.5678") into a BigInt scaled by 10^scale,
 * rounding half away from zero if the input has more fractional digits than `scale`.
 */
export function parseDecimalToScaled(raw: string, scale: number): bigint {
  const trimmed = raw.trim()
  const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(trimmed)
  if (!match) {
    throw new RangeError(`Invalid decimal string: "${raw}"`)
  }

  const isNegative = match[1] === '-'
  const intPart = match[2]
  const fracPart = match[3] ?? ''

  let scaled: bigint
  if (fracPart.length <= scale) {
    const padded = fracPart.padEnd(scale, '0')
    scaled = BigInt(intPart + padded)
  } else {
    const kept = fracPart.slice(0, scale)
    const nextDigit = Number(fracPart[scale])
    scaled = BigInt(intPart + kept)
    if (nextDigit >= 5) {
      scaled += ONE
    }
  }

  return isNegative && scaled !== ZERO ? -scaled : scaled
}

function addThousandsSeparators(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Format a scaled BigInt into a human-readable decimal string with `,` grouping.
 */
export function formatScaled(
  scaled: bigint,
  scale: number,
  options?: {
    trimTrailingZeros?: boolean
    showPlus?: boolean
  },
): string {
  const isNegative = scaled < ZERO
  const abs = isNegative ? -scaled : scaled
  const sign = isNegative ? '-' : options?.showPlus && abs > ZERO ? '+' : ''

  if (scale === 0) {
    return `${sign}${addThousandsSeparators(abs.toString())}`
  }

  const raw = abs.toString().padStart(scale + 1, '0')
  const intPart = raw.slice(0, raw.length - scale)
  let fracPart = raw.slice(raw.length - scale)

  if (options?.trimTrailingZeros) {
    fracPart = fracPart.replace(/0+$/, '')
  }

  const formattedInt = addThousandsSeparators(intPart)
  return fracPart.length > 0 ? `${sign}${formattedInt}.${fracPart}` : `${sign}${formattedInt}`
}

/**
 * Format a monetary decimal string using the currency's ISO 4217 minor units.
 */
export function formatMoney(
  value: string,
  currency: string,
  minorUnits = 2,
  options?: { showPlus?: boolean; includeCurrency?: boolean },
): string {
  const scale = Math.max(0, Math.min(4, minorUnits))
  const scaled = parseDecimalToScaled(value, scale)
  const formatted = formatScaled(scaled, scale, { showPlus: options?.showPlus })
  if (options?.includeCurrency === false) return formatted
  return `${formatted} ${currency}`
}

/**
 * Format a position quantity decimal string, trimming insignificant trailing zeros.
 */
export function formatQuantity(value: string, maxFractionDigits = 4): string {
  const scaled = parseDecimalToScaled(value, maxFractionDigits)
  return formatScaled(scaled, maxFractionDigits, { trimTrailingZeros: true })
}

export interface UnrealizedPnl {
  direction: 'positive' | 'negative' | 'flat'
  amount: string
  percent: string | null
}

const MONEY_SCALE = 4

/**
 * Compute exact unrealized P&L (`marketValue - costBasis`) and percentage return
 * using scaled BigInt arithmetic.
 */
export function computeUnrealizedPnl(
  marketValue: string,
  costBasis: string,
  minorUnits = 2,
): UnrealizedPnl {
  const mv = parseDecimalToScaled(marketValue, MONEY_SCALE)
  const cb = parseDecimalToScaled(costBasis, MONEY_SCALE)
  const diff = mv - cb

  const direction: UnrealizedPnl['direction'] =
    diff > ZERO ? 'positive' : diff < ZERO ? 'negative' : 'flat'

  // Round diff from MONEY_SCALE (4) down to display scale (minorUnits).
  const displayScale = Math.max(0, Math.min(MONEY_SCALE, minorUnits))
  const drop = MONEY_SCALE - displayScale
  let displayDiff = diff
  if (drop > 0) {
    const divisor = pow10(drop)
    const half = divisor / TWO
    displayDiff = diff >= ZERO ? (diff + half) / divisor : (diff - half) / divisor
  }

  const amount = formatScaled(displayDiff, displayScale, { showPlus: true })

  let percent: string | null = null
  if (cb > ZERO) {
    // Basis points (100.00% = 10000) with half-away-from-zero rounding.
    const numerator = diff * BigInt(10_000)
    const halfCb = cb / TWO
    const bps = diff >= ZERO ? (numerator + halfCb) / cb : (numerator - halfCb) / cb
    percent = `${formatScaled(bps, 2, { showPlus: true })}%`
  }

  return { direction, amount, percent }
}

/**
 * Exact subtraction (`a - b`) of two decimal strings, returning a plain decimal string.
 */
export function subtractDecimals(a: string, b: string, scale = MONEY_SCALE): string {
  const diff = parseDecimalToScaled(a, scale) - parseDecimalToScaled(b, scale)
  const isNegative = diff < ZERO
  const abs = isNegative ? -diff : diff
  if (scale === 0) return `${isNegative ? '-' : ''}${abs.toString()}`
  const raw = abs.toString().padStart(scale + 1, '0')
  const intPart = raw.slice(0, raw.length - scale)
  const fracPart = raw.slice(raw.length - scale)
  return `${isNegative ? '-' : ''}${intPart}.${fracPart}`
}

const COMPACT_TIERS = [
  { threshold: BigInt('1000000000000'), suffix: 'T', divisor: BigInt('10000000000') },
  { threshold: BigInt('1000000000'), suffix: 'B', divisor: BigInt('10000000') },
  { threshold: BigInt('1000000'), suffix: 'M', divisor: BigInt('10000') },
  { threshold: BigInt('1000'), suffix: 'K', divisor: BigInt('10') },
] as const

/**
 * Format a large monetary decimal string in compact form (e.g. "245.12B USD")
 * using exact BigInt scaling, falling back to full formatMoney below 1,000.
 */
export function formatCompactMoney(
  value: string,
  currency: string,
  minorUnits = 2,
  options?: { showPlus?: boolean },
): string {
  const whole = parseDecimalToScaled(value, 0)
  const absWhole = whole < ZERO ? -whole : whole

  for (const tier of COMPACT_TIERS) {
    if (absWhole >= tier.threshold) {
      const half = tier.divisor / TWO
      // Compute value in hundredths of the tier unit (2 decimal places).
      const scaledCenti =
        whole >= ZERO ? (whole + half) / tier.divisor : (whole - half) / tier.divisor
      const formatted = formatScaled(scaledCenti, 2, { showPlus: options?.showPlus })
      return `${formatted}${tier.suffix} ${currency}`
    }
  }

  return formatMoney(value, currency, minorUnits, { showPlus: options?.showPlus })
}

export function formatSharePercent(part: number, total: number): string {
  if (total <= 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatInteger(value: number): string {
  return integerFormatter.format(value)
}

const utcDateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  timeZone: 'UTC',
})

const utcTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

export function formatUtcDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return utcDateFormatter.format(date)
}

export function formatUtcDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return `${utcDateFormatter.format(date)}, ${utcTimeFormatter.format(date)} UTC`
}
