import { NextRequest } from 'next/server'
import { getEffectivePrices } from '@/lib/server-store'
import { jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

// 公开接口：返回应用了后台价格覆盖后的有效定价（花/种子/工具/费率/上下限）
// 供前台市场展示、上架价格合理性校验与后台共用，保证展示与结算一致
export async function GET(req: NextRequest) {
  try {
    const prices = await getEffectivePrices()
    return jsonResponse(true, prices)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}