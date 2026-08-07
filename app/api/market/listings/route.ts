import { NextRequest } from 'next/server'
import { getListings, getBuyOrders } from '@/lib/server-store'
import { jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') as 'flower' | 'seed' | 'tool' | undefined
    return jsonResponse(true, await getListings(type))
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
