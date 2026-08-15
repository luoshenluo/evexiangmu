import { NextRequest } from 'next/server'
import { jsonResponse } from '@/lib/auth'
import { getTodayBouquetPrices } from '@/lib/bouquet-config'

export const runtime = 'edge'

// 获取今日官方花束收购价（各等级）
export async function GET(req: NextRequest) {
  try {
    const prices = getTodayBouquetPrices()
    return jsonResponse(true, { prices, generatedAt: Date.now() })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
