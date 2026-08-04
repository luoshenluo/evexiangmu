import { getBuyOrders } from '@/lib/server-store'
import { jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function GET() {
  try {
    return jsonResponse(true, await getBuyOrders())
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
