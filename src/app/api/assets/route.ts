import { type NextRequest, NextResponse } from 'next/server'
import { listAssets, serializeAssetItem } from '@/features/assets/queries'
import { type RawSearchParams, parseAssetSearchParams } from '@/features/assets/schemas'

export async function GET(request: NextRequest) {
  const raw: RawSearchParams = {}
  request.nextUrl.searchParams.forEach((value, key) => {
    if (raw[key] === undefined) raw[key] = value
  })

  const query = parseAssetSearchParams(raw)
  const rawLimit = Number(request.nextUrl.searchParams.get('limit'))
  const limitOverride =
    Number.isFinite(rawLimit) && rawLimit >= 25 ? Math.min(500, Math.floor(rawLimit)) : 200

  try {
    const result = await listAssets(query, { limitOverride })
    return NextResponse.json(
      {
        items: result.items.map(serializeAssetItem),
        hasNextPage: result.hasNextPage,
        nextCursor: result.nextCursor,
        approxTotal: result.approxTotal,
        isFiltered: result.isFiltered,
        queryMs: result.queryMs,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (error) {
    console.error('[GET /api/assets] query failed:', error)
    return NextResponse.json({ error: 'Failed to query assets' }, { status: 500 })
  }
}
