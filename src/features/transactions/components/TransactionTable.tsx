import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  CornerUpLeft,
  Undo2,
} from 'lucide-react'
import Link from 'next/link'
import { formatInteger, formatMoney, formatQuantity, formatUtcDate } from '@/lib/format'
import type { TransactionListResult } from '../queries'
import {
  TRANSACTION_TYPE_LABELS,
  type TransactionListQuery,
  type TransactionTypeValue,
  buildTransactionListHref,
} from '../schemas'

const TYPE_BADGE_STYLES: Record<TransactionTypeValue, string> = {
  buy: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  sell: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  transfer_in: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  transfer_out: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  dividend: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  interest: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  fee: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  revaluation: 'bg-neutral-100 text-neutral-700 ring-neutral-500/20',
  depreciation: 'bg-orange-50 text-orange-800 ring-orange-600/20',
  disposal: 'bg-purple-50 text-purple-700 ring-purple-600/20',
}

const TH = 'px-3.5 py-2.5 text-xs font-semibold tracking-wider text-neutral-600 uppercase'

function shortId(uuid: string): string {
  return uuid.slice(0, 8)
}

function signTone(value: string): string {
  if (/^-/.test(value)) return 'text-rose-700'
  if (/^0*(\.0*)?$/.test(value)) return 'text-neutral-500'
  return 'text-emerald-700'
}

function PagerLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  const base = 'inline-flex h-8 items-center gap-1 rounded-md border px-2.5 font-medium'
  return href ? (
    <Link
      href={href}
      className={`${base} border-neutral-300 bg-white text-neutral-700 transition-colors hover:bg-neutral-100`}
    >
      {children}
    </Link>
  ) : (
    <span
      aria-disabled="true"
      className={`${base} border-neutral-200 bg-neutral-100/70 text-neutral-400`}
    >
      {children}
    </span>
  )
}

export function TransactionTable({
  query,
  result,
}: {
  query: TransactionListQuery
  result: TransactionListResult
}) {
  const { items, hasPrevPage, nextCursor, prevCursor, approxTotal, isFiltered, queryMs } = result

  const toggleDirHref = buildTransactionListHref({
    ...query,
    dir: query.dir === 'desc' ? 'asc' : 'desc',
    cursor: undefined,
  })
  const DirIcon = query.dir === 'desc' ? ArrowDown : ArrowUp

  return (
    <section
      aria-label="Transaction ledger"
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xs"
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th
                scope="col"
                aria-sort={query.dir === 'asc' ? 'ascending' : 'descending'}
                className={`${TH} text-left`}
              >
                <Link
                  href={toggleDirHref}
                  title="Execution date of the transaction and contractual settlement date (if applicable)"
                  className="dotted-alias text-primary inline-flex items-center gap-1 hover:text-neutral-950"
                >
                  Trade / Settle
                  <DirIcon aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </th>
              <th
                scope="col"
                className={`${TH} dotted-alias text-left`}
                title="The holding affected by this entry (ticker symbol and name)"
              >
                Asset
              </th>
              <th
                scope="col"
                className={`${TH} dotted-alias text-left`}
                title="Ledger event classification"
              >
                Type
              </th>
              <th
                scope="col"
                className={`${TH} dotted-alias text-right`}
                title="Signed change in units held. Positive values increase the position; negative values reduce it; zero indicates a cash or book-value event."
              >
                Quantity
              </th>
              <th
                scope="col"
                className={`${TH} dotted-alias text-right`}
                title="Execution or valuation price per unit in the transaction currency (if not unit-priced)."
              >
                Price
              </th>
              <th
                scope="col"
                className={`${TH} dotted-alias text-right`}
                title="Signed net cash or book-value impact in the transaction currency. Strikethrough indicates the entry was later reversed."
              >
                Amount
              </th>
              <th
                scope="col"
                className={`${TH} dotted-alias text-left`}
                title="Append-only audit link showing if this entry cancels an earlier transaction or was cancelled by a later one, along with booking notes."
              >
                Reversal
              </th>
              <th
                scope="col"
                className={`${TH} dotted-alias text-left`}
                title="Unique public transaction identifier (hover for full UUID) and the operator or system feed that booked the entry."
              >
                Txn ID / Booked by
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100 bg-white">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-14 text-center">
                  <p className="text-sm font-medium text-neutral-900">
                    {isFiltered
                      ? 'No transactions match the current filters'
                      : 'No transactions recorded yet'}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {isFiltered
                      ? 'Try widening the date range or clearing a filter.'
                      : 'Seed the database with pnpm db:seed to populate the ledger.'}
                  </p>
                </td>
              </tr>
            ) : (
              items.map((tx) => {
                const isReversed = tx.reversedByPublicId !== null
                const isReversal = tx.reversesPublicId !== null
                const rowTone = isReversal
                  ? 'bg-amber-50/40'
                  : isReversed
                    ? 'bg-neutral-50/70 text-neutral-500'
                    : 'odd:bg-white even:bg-neutral-50/70'

                return (
                  <tr
                    key={tx.publicId}
                    className={`transition-colors hover:bg-neutral-100/70 ${rowTone}`}
                  >
                    <td className="px-3.5 py-2.5 align-top whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-neutral-900 tabular-nums">
                        {formatUtcDate(tx.tradeDate)}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-neutral-500 tabular-nums">
                        {tx.settleDate
                          ? `Settles ${formatUtcDate(tx.settleDate)}`
                          : 'No settlement'}
                      </div>
                    </td>

                    <td className="max-w-64 px-3.5 py-2.5 align-top">
                      <Link
                        href={buildTransactionListHref({ asset: tx.assetPublicId })}
                        className="group block"
                        title="Show all transactions for this asset"
                      >
                        <span className="group-hover:text-primary font-mono text-xs font-semibold text-neutral-950">
                          {tx.assetSymbol}
                        </span>
                        <div className="mt-0.5 truncate text-xs text-neutral-500">
                          {tx.assetName}
                        </div>
                      </Link>
                    </td>

                    <td className="px-3.5 py-2.5 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TYPE_BADGE_STYLES[tx.type]}`}
                      >
                        {TRANSACTION_TYPE_LABELS[tx.type]}
                      </span>
                    </td>

                    <td
                      className={`px-3.5 py-2.5 text-right align-top font-mono text-xs whitespace-nowrap tabular-nums ${signTone(tx.quantity)}`}
                    >
                      {formatQuantity(tx.quantity)}
                    </td>

                    <td className="px-3.5 py-2.5 text-right align-top font-mono text-xs whitespace-nowrap text-neutral-700 tabular-nums">
                      {tx.price ? formatQuantity(tx.price, 4) : '—'}
                    </td>

                    <td
                      className={`px-3.5 py-2.5 text-right align-top font-mono text-xs font-semibold whitespace-nowrap tabular-nums ${signTone(tx.amount)} ${isReversed ? 'line-through decoration-neutral-400' : ''}`}
                    >
                      {formatMoney(tx.amount, tx.currency, tx.currencyMinorUnits, {
                        showPlus: true,
                      })}
                    </td>

                    <td className="px-3.5 py-2.5 align-top text-xs whitespace-nowrap">
                      {isReversal && tx.reversesPublicId && (
                        <Link
                          href={buildTransactionListHref({ q: tx.reversesPublicId })}
                          className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 font-medium text-amber-900 hover:bg-amber-200"
                          title={`Reverses transaction ${tx.assetPublicId}`}
                        >
                          <Undo2 aria-hidden="true" className="h-3 w-3" />
                          Reverses <span className="font-mono">{shortId(tx.assetPublicId)}</span>
                        </Link>
                      )}
                      {isReversed && tx.reversedByPublicId && (
                        <Link
                          href={buildTransactionListHref({ q: tx.reversedByPublicId })}
                          className="inline-flex items-center gap-1 rounded-md bg-neutral-200 px-2 py-0.5 font-medium text-neutral-700 hover:bg-neutral-300"
                          title={`Reversed by transaction ${tx.reversedByPublicId}`}
                        >
                          <CornerUpLeft aria-hidden="true" className="h-3 w-3" />
                          Reversed by{' '}
                          <span className="font-mono">{shortId(tx.reversedByPublicId)}</span>
                        </Link>
                      )}
                      {!isReversal && !isReversed && <span className="text-neutral-300">—</span>}
                      {tx.memo && (
                        <div className="mt-1 max-w-48 truncate text-[11px] text-neutral-500">
                          {tx.memo}
                        </div>
                      )}
                    </td>

                    <td className="px-3.5 py-2.5 align-top whitespace-nowrap">
                      <div
                        className="font-mono text-[11px] font-medium text-neutral-700"
                        title={tx.publicId}
                      >
                        {shortId(tx.publicId)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-neutral-500">{tx.createdBy}</div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-start justify-between gap-3 border-t border-neutral-200 bg-neutral-50/70 px-4 py-3 text-xs text-neutral-600 sm:flex-row sm:items-center">
        <div>
          Showing <span className="font-semibold text-neutral-900">{items.length}</span>{' '}
          {items.length === 1 ? 'entry' : 'entries'}
          {!isFiltered && approxTotal !== null && (
            <>
              {' '}
              of ~
              <span className="font-semibold text-neutral-900">{formatInteger(approxTotal)}</span>
            </>
          )}
          {isFiltered && <span className="text-neutral-500"> (filtered view)</span>}
          <span className="ml-2 font-mono text-neutral-400">· {queryMs}ms</span>
        </div>

        <nav aria-label="Pagination" className="flex items-center gap-1.5">
          <PagerLink
            href={hasPrevPage ? buildTransactionListHref({ ...query, cursor: undefined }) : null}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
            First
          </PagerLink>
          <PagerLink
            href={
              prevCursor
                ? buildTransactionListHref({ ...query, cursor: prevCursor, cursorDir: 'prev' })
                : null
            }
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </PagerLink>
          <PagerLink
            href={
              nextCursor
                ? buildTransactionListHref({ ...query, cursor: nextCursor, cursorDir: 'next' })
                : null
            }
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </PagerLink>
        </nav>
      </div>
    </section>
  )
}
