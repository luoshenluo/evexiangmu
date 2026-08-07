import { NextRequest } from 'next/server'
import { getStealLogs } from '@/lib/server-store'
import { authRequest, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

// 获取我被偷花的记录
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)

    const logs = await getStealLogs(user.id, limit)
    return jsonResponse(true, logs)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
