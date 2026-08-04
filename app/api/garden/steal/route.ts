import { NextRequest } from 'next/server'
import { ensureSeasonTick, attemptSteal } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 偷花
export async function POST(req: NextRequest) {
  try {
    await ensureSeasonTick()
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { victimId, plotId } = await req.json()
    if (!victimId || !plotId) return jsonResponse(false, null, '参数错误', 400)

    logger.info('steal', '偷花请求', { thiefId: user.id, victimId, plotId })

    const result = await attemptSteal(user.id, victimId, plotId)

    // 重新获取偷花者数据（计数可能已更新）
    const { findUserById } = await import('@/lib/server-store')
    const updatedUser = await findUserById(user.id)

    return jsonResponse(result.success, {
      user: sanitizeUser(updatedUser),
      message: result.message,
      flower: result.flower || null,
    }, result.success ? undefined : result.message, result.success ? 200 : 400)
  } catch (e: any) {
    logger.error('steal', '偷花异常', { error: e.message })
    return jsonResponse(false, null, e.message, 500)
  }
}
